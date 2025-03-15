import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { NovelWithChapters, Reference } from '@/types';
import { truncateContext } from '@/utils/tokenizer';
import { getNovel } from '@/services/storage';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MinimalTranslationRequest {
  sourceContent: string;
  novelId: string;
  currentChapterId?: string;
  previousTranslation?: string;
  qualityFeedback?: string;
  useImprovementFeedback?: boolean;
}

async function makeTranslationRequest(
  url: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  apiKey: string,
) {
  const response = await axios.post(
    url,
    {
      model,
      messages,
      temperature,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  return response;
}

async function constructMessages(
  novel: NovelWithChapters,
  request: MinimalTranslationRequest,
): Promise<{
  messages: ChatMessage[];
  tokenCounts: { system: number; task: number; translation: number };
}> {
  // Format references with titles
  const referencesText =
    novel.references.length > 0
      ? "Here are references to use to assist in translation. Use them to help with the translation, but don't mention them in the translation:\n" +
        novel.references
          .map(
            (ref: Reference) =>
              `<ref src="${ref.title}">\n${ref.content}\n</ref src="${ref.title}">`,
          )
          .join('\n\n')
      : '';

  // Get previous chapters from the novel object
  let context: ChatMessage[] = [];
  if (novel.chapters && novel.chapters.length > 0) {
    // Filter out the current chapter if it exists
    const previousChapters = novel.chapters.filter(
      (chapter) =>
        !request.currentChapterId || chapter.id !== request.currentChapterId,
    );

    // Format previous chunks as context
    context = previousChapters
      .map((chapter, index) => ({
        pair: [
          {
            role: 'user' as const,
            content: `${chapter.sourceContent}`,
          },
          {
            role: 'assistant' as const,
            content: `${chapter.translatedContent}`,
          },
        ],
        originalIndex: index,
      }))
      // Randomize the order of the chapters, but weight it such that it's still most likely to be in the same order as the source content
      .sort((a, b) => {
        // Higher bias value = stronger tendency to preserve original order
        const bias = 8;
        // Compare original positions, but add a smaller random component
        return a.originalIndex - b.originalIndex + (Math.random() - 0.5) / bias;
      })
      .flatMap((item) => item.pair);
  }

  // Build improvement context when retranslating with previous translation and feedback
  let improvementPrompt = '';
  if (
    request.previousTranslation &&
    request.qualityFeedback &&
    request.useImprovementFeedback
  ) {
    improvementPrompt = `Here is a previous translation attempt with quality feedback. Please improve upon this translation addressing the issues mentioned:
Previous translation:

${request.previousTranslation}

Quality feedback:
${request.qualityFeedback}
`;
  }

  const translationTemplate =
    novel.translationTemplate ||
    'Translate the following text from ${sourceLanguage} to ${targetLanguage}. Make sure to preserve and translate the header.${improvementPrompt}\n\n${sourceContent}';

  const translationInstruction = translationTemplate
    .replaceAll('${sourceLanguage}', novel.sourceLanguage)
    .replaceAll('${targetLanguage}', novel.targetLanguage)
    .replaceAll('${sourceContent}', request.sourceContent)
    .replaceAll('${improvementPrompt}', improvementPrompt);

  // Create messages for the API call
  const messages: ChatMessage[] = [
    {
      role: 'system' as const,
      content: `${novel.systemPrompt}`,
    },
    {
      role: 'user' as const,
      content: `${referencesText}\n\nYou may be provided examples of previous translations. Use them to help with the translation.`,
    },
    ...context,
    {
      role: 'user' as const,
      content: translationInstruction,
    },
  ];

  // Truncate messages to respect token limits
  const { messages: truncatedMessages, tokenCounts } =
    await truncateContext(messages);
  console.log('Truncated messages', {
    tokenCounts,
    length: truncatedMessages.length,
  });

  return { messages: truncatedMessages as ChatMessage[], tokenCounts };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const request = req.body as MinimalTranslationRequest;
    if (!request.novelId) {
      return res.status(400).json({ message: 'Novel ID is required' });
    }

    // Fetch the novel first to get all the metadata
    const novel = await getNovel(request.novelId, {
      start: 0,
      end: 999999, // Large number to ensure we get all chapters
    }, req);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
    const model = process.env.TRANSLATION_MODEL || 'gpt-4';
    const temperature = parseFloat(
      process.env.TRANSLATION_TEMPERATURE || '0.1',
    );
    const apiKey = process.env.OPENAI_API_KEY!;

    // Construct messages on the server side using novel metadata
    const { messages, tokenCounts } = await constructMessages(novel, request);
    console.log(
      `Making translation request with ${messages.length} messages (model: ${model}, temperature: ${temperature})`,
    );

    // First attempt
    let apiResponse = await makeTranslationRequest(
      url,
      messages,
      model,
      temperature,
      apiKey,
    );

    // Check if we hit the length limit and retry once if needed
    if (apiResponse.data.choices[0].finish_reason === 'length') {
      console.log('Hit length limit, retrying with the same parameters...');
      apiResponse = await makeTranslationRequest(
        url,
        messages,
        model,
        temperature,
        apiKey,
      );
    }

    // Extract translation from the response
    const translation = apiResponse.data.choices[0].message.content;
    // Extract token usage from the response
    const tokenUsage = apiResponse.data.usage;
    console.log('response', {
      apiResponse,
      usage: tokenUsage,
    });

    // Return the translation along with the novel's language settings for quality check
    return res.status(200).json({
      translation,
      tokenUsage,
      sourceLanguage: novel.sourceLanguage,
      targetLanguage: novel.targetLanguage,
      tokenCounts: {
        system: tokenCounts.system,
        task: tokenCounts.task,
        translation: tokenCounts.translation,
      },
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API error:', error.response?.data || error.message);
      return res.status(500).json({
        message: 'Error processing translation',
        error: error.message,
      });
    }
    const message = error instanceof Error ? error.message : `${error}`;
    return res.status(500).json({
      message: 'Error processing translation',
      error: message,
    });
  }
}

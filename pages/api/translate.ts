import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { NovelWithChapters, Reference } from '@/types';
import { truncateContext } from '@/utils/tokenizer';
import { getNovelById } from '@/utils/fileStorage';
import { serverConfig } from '../../config';

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
      ...(model.includes('gemini')
        ? {
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
                threshold: 'BLOCK_NONE',
              },
            ],
          }
        : {}),
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
    // Also filter out chapters with low quality translations
    const previousChapters = novel.chapters.filter((chapter) => {
      const isNotCurrentChapter =
        !request.currentChapterId || chapter.id !== request.currentChapterId;
      const isGoodTranslation =
        chapter.qualityCheck && chapter.qualityCheck.score >= 6;
      return isNotCurrentChapter && isGoodTranslation;
    });

    // Get the index of the current chapter
    const currentChapterIndex = request.currentChapterId
      ? novel.chapters.findIndex(
          (chapter) => chapter.id === request.currentChapterId,
        )
      : novel.chapters.length;

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
        // Calculate distance from current chapter, if there is one
        distanceFromCurrent:
          currentChapterIndex !== -1
            ? Math.abs(index - currentChapterIndex)
            : index, // If no current chapter, use index as distance
      }))
      // Sort by distance from current chapter, with closest chapters at the end
      .sort((a, b) => {
        const distanceWeight = 10; // Higher value means distance has more influence
        const randomFactor = (Math.random() - 0.5) * 0.2; // Small random factor for variety
        return (
          (b.distanceFromCurrent - a.distanceFromCurrent) * distanceWeight +
          randomFactor
        );
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
    improvementPrompt = `Apply the following feedback to improve the translation. Do not discuss the feedback or explain your changes - just incorporate them into your translation:

PREVIOUS TRANSLATION:
<previous_translation>
${request.previousTranslation}
</previous_translation>

FEEDBACK TO ADDRESS:
<feedback>
${request.qualityFeedback}
</feedback>

Remember: Your response must contain ONLY the improved translation text.`;
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
      content: `${referencesText}${context.length > 0 ? '\n\nYou are provided the the translations of previous chapters. Use them to help with guide translation.' : ''}`,
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
    const novel = await getNovelById(request.novelId, {
      start: 0,
      end: 999999, // Large number to ensure we get all chapters
    });
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    const url = `${serverConfig.openaiBaseUrl}/chat/completions`;
    const model = serverConfig.translationModel;
    const temperature = serverConfig.translationTemperature;
    const apiKey = serverConfig.openaiApiKey;

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
    console.log('translation response', {
      responseHeaders: apiResponse.headers,
      responseBody: apiResponse.data,
      usage: tokenUsage,
      finishReason: apiResponse.data.choices[0].finish_reason,
      safetyResults: JSON.stringify(apiResponse.data.vertex_ai_safety_results),
    });

    // Post process the translation to remove any known issues
    const postProcessedTranslation = postProcessTranslation(translation);

    // Return the translation along with the novel's language settings for quality check
    return res.status(200).json({
      translation: postProcessedTranslation,
      tokenUsage,
      sourceLanguage: novel.sourceLanguage,
      targetLanguage: novel.targetLanguage,
      tokenCounts: {
        system: tokenCounts.system,
        task: tokenCounts.task,
        translation: tokenCounts.translation,
      },
      finishReason: apiResponse.data.choices[0].finish_reason,
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

function postProcessTranslation(translation: string) {
  // Remove any XML like tags including closing tags
  translation = translation.replace(/<\/?[^>]*>/g, '');
  // Remove any markdown code blocks using backticks
  translation = translation.replace(/```[\s\S]*?```/g, '');
  // Trim whitespace
  translation = translation.trim();
  // Check if there's a second title header (eg # Chapter 2), and remove all content after it
  const secondHeaderIndex = translation.indexOf('\n# ');
  if (secondHeaderIndex !== -1) {
    translation = translation.substring(0, secondHeaderIndex);
  }
  return translation;
}

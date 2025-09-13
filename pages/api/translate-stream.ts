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

async function constructMessages(
  novel: NovelWithChapters,
  request: MinimalTranslationRequest,
): Promise<{
  messages: ChatMessage[];
  tokenCounts: { system: number; task: number; translation: number };
}> {
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

  let context: ChatMessage[] = [];
  if (novel.chapters && novel.chapters.length > 0) {
    const previousChapters = novel.chapters.filter((chapter) => {
      const isNotCurrentChapter =
        !request.currentChapterId || chapter.id !== request.currentChapterId;
      const isGoodTranslation =
        chapter.qualityCheck && chapter.qualityCheck.score >= 6;
      return isNotCurrentChapter && isGoodTranslation;
    });

    const currentChapterIndex = request.currentChapterId
      ? novel.chapters.findIndex((chapter) => chapter.id === request.currentChapterId)
      : novel.chapters.length;

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
        distanceFromCurrent:
          currentChapterIndex !== -1
            ? Math.abs(index - currentChapterIndex)
            : index,
      }))
      .sort((a, b) => {
        const distanceWeight = 10;
        const randomFactor = (Math.random() - 0.5) * 0.2;
        return (
          (b.distanceFromCurrent - a.distanceFromCurrent) * distanceWeight +
          randomFactor
        );
      })
      .flatMap((item) => item.pair);
  }

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

  const { messages: truncatedMessages, tokenCounts } = await truncateContext(messages);
  return { messages: truncatedMessages as ChatMessage[], tokenCounts };
}

function postProcessTranslation(translation: string) {
  translation = translation.replace(/<\/?[^>]*>/g, '');
  translation = translation.replace(/```[\s\S]*?```/g, '');
  translation = translation.trim();
  const secondHeaderIndex = translation.indexOf('\n# ');
  if (secondHeaderIndex !== -1) {
    translation = translation.substring(0, secondHeaderIndex);
  }
  return translation;
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

    const novel = await getNovelById(request.novelId, {
      start: 0,
      end: 999999,
    });
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    const url = `${serverConfig.openaiBaseUrl}/chat/completions`;
    const model = serverConfig.translationModel;
    const temperature = serverConfig.translationTemperature;
    const apiKey = serverConfig.openaiApiKey;

    const { messages, tokenCounts } = await constructMessages(novel, request);

    // Setup SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial meta
    writeEvent({
      type: 'meta',
      sourceLanguage: novel.sourceLanguage,
      targetLanguage: novel.targetLanguage,
      tokenCounts,
      model,
      temperature,
    });

    // Call upstream streaming API
    const response = await axios.post(
      url,
      {
        model,
        messages,
        temperature,
        max_tokens: serverConfig.maxTranslationOutputTokens,
        stream: true,
        stream_options: { include_usage: true },
        ...(model.includes('gemini')
          ? {
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
              ],
            }
          : {}),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        responseType: 'stream',
      },
    );

    const stream: NodeJS.ReadableStream = response.data;

    let buffer = '';
    let aggregatedContent = '';
    let finishReason: string | null = null;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

    const handleEvent = (eventBlock: string) => {
      const lines = eventBlock.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice('data:'.length).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta || {};
          const deltaReasoning: string | undefined = delta.reasoning_content;
          const deltaContent: string | undefined = delta.content;
          if (typeof deltaReasoning === 'string' && deltaReasoning.length > 0) {
            writeEvent({ type: 'reasoning_delta', text: deltaReasoning });
          }
          if (typeof deltaContent === 'string' && deltaContent.length > 0) {
            aggregatedContent += deltaContent;
            writeEvent({ type: 'content_delta', text: deltaContent });
          }
          if (choice && choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
          if (parsed.usage) {
            usage = parsed.usage;
            writeEvent({ type: 'usage', usage });
          }
        } catch {
          // Ignore JSON parse errors for non-JSON lines
        }
      }
    };

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleEvent(eventBlock);
      }
    });

    stream.on('end', () => {
      if (buffer.length > 0) {
        handleEvent(buffer);
      }
      const finalTranslation = postProcessTranslation(aggregatedContent);
      writeEvent({
        type: 'final',
        translatedContent: finalTranslation,
        finishReason,
        usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
        tokenCounts,
      });
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (err: unknown) => {
      writeEvent({ type: 'error', message: err instanceof Error ? err.message : `${err}` });
      res.write('data: [DONE]\n\n');
      res.end();
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API error (stream):', error.response?.data || error.message);
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      } catch {
        return res.status(500).json({ message: 'Error processing translation (stream)', error: error.message });
      }
    }
    const message = error instanceof Error ? error.message : `${error}`;
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch {
      return res.status(500).json({ message: 'Error processing translation (stream)', error: message });
    }
  }
}



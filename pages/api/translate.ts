import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { NovelWithChapters, Reference, TranslationPostprocessOptions } from '@/types';
import { truncateContext } from '@/utils/tokenizer';
import { getNovelById } from '@/utils/fileStorage';
import { postProcessTranslation } from '@/utils/postProcessTranslation';
import { extractToolcallsAndStrip } from '@/utils/extractToolcalls';
import { normalizeToolCalls } from '@/utils/toolCalls';
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
  useStreaming?: boolean;
}

const postprocessOptions: TranslationPostprocessOptions = {
  removeXmlTags: serverConfig.postprocessRemoveXmlTags,
  removeCodeBlocks: serverConfig.postprocessRemoveCodeBlocks,
  trimWhitespace: serverConfig.postprocessTrimWhitespace,
  truncateAfterSecondHeader: serverConfig.postprocessTruncateAfterSecondHeader,
};

async function makeTranslationRequest(
  url: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  apiKey: string,
  maxOutputTokens: number,
) {
  const response = await axios.post(
    url,
    {
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
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

async function makeStreamingTranslationRequest(
  url: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  apiKey: string,
  maxOutputTokens: number,
): Promise<{
  content: string;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  finishReason: string | null;
  headers: Record<string, string>;
}> {
  const response = await axios.post(
    url,
    {
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
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
      responseType: 'stream',
    },
  );

  const stream: NodeJS.ReadableStream = response.data;
  return await new Promise((resolve, reject) => {
    let buffer = '';
    let content = '';
    let finishReason: string | null = null;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    let doneSeen = false;

    const handleEvent = (eventBlock: string) => {
      // Each event block may contain multiple lines; parse lines starting with `data:`
      const lines = eventBlock.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice('data:'.length).trim();
        if (!dataStr) continue;
        if (dataStr === '[DONE]') {
          doneSeen = true;
          continue;
        }
        try {
          const parsed = JSON.parse(dataStr);
          const choice = parsed.choices?.[0];
          const deltaContent: string | undefined = choice?.delta?.content;
          if (typeof deltaContent === 'string') {
            content += deltaContent;
          }
          if (choice && choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
          if (parsed.usage) {
            usage = parsed.usage;
          }
        } catch {
          // Ignore JSON parse errors for non-JSON lines
        }
      }
    };

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      // SSE events are separated by double newlines
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleEvent(eventBlock);
      }
    });

    stream.on('end', () => {
      // Handle any remaining buffer
      if (buffer.length > 0) {
        handleEvent(buffer);
      }
      if (!doneSeen) {
        return reject(new Error('Streaming response ended without [DONE] marker. Incomplete response.'));
      }
      resolve({ content, usage, finishReason, headers: response.headers as Record<string, string> });
    });

    stream.on('error', (err: unknown) => {
      reject(err);
    });
  });
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
              `<ref id="${ref.id}" title="${ref.title}">\n${ref.content}\n</ref>`,
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

  const toolingInstructions = `Formatting instructions for reference updates:
1) Output ONLY the final translation text first (no tags or code blocks).
2) If you propose reference changes, append exactly one fenced block afterwards:
\`\`\`toolcalls
{"reference_ops": [ /* zero or more ops */ ]}
\`\`\`
- Allowed ops: "reference.add", "reference.update".
- Prefer using existing reference \"id\" for updates; otherwise use exact \"title\".
- Keep each op concise. Do not include this block if there are no changes.
- Example:
\`\`\`toolcalls
{"reference_ops": [
  {"type": "reference.add", "title": "John Doe", "content": "John Doe (ジョン・ドゥ) is a character in the story."},
  {"type": "reference.update", "id": "123", "title": "Jane Doe", "content": "Jane Doe (ジェーン・ドウ) is a character in the story."}
]}
\`\`\`

Use references to keep track of information that would be helpful for future translations, such as character names, locations, etc.`;

  // Optionally include tool instructions depending on per-novel or global config
  const toolCallsEnabled = (serverConfig.modelConfigEnable && (novel.translationToolCallsEnable ?? null) !== null)
    ? Boolean(novel.translationToolCallsEnable)
    : serverConfig.translationToolCallsEnable;

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
    toolCallsEnabled
      ? {
          role: 'user' as const,
          content: toolingInstructions + '\n\n' + translationInstruction,
        }
      : {
          role: 'user' as const,
          content: translationInstruction,
        },
  ];

  // Truncate messages to respect token limits
  // Allow per-novel maxTokens override when enabled
  const maxContextTokens = serverConfig.modelConfigEnable && (novel.maxTokens ?? undefined)
    ? (novel.maxTokens as number)
    : serverConfig.maxTokens;

  const { messages: truncatedMessages, tokenCounts } =
    await truncateContext(messages, maxContextTokens);
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
    const model = serverConfig.modelConfigEnable && novel.translationModel
      ? novel.translationModel
      : serverConfig.translationModel;
    const temperature = serverConfig.translationTemperature;
    const apiKey = serverConfig.openaiApiKey;
    const maxOutputTokens = serverConfig.modelConfigEnable && (novel.maxTranslationOutputTokens ?? undefined)
      ? (novel.maxTranslationOutputTokens as number)
      : serverConfig.maxTranslationOutputTokens;

    // Construct messages on the server side using novel metadata
    const { messages, tokenCounts } = await constructMessages(novel, request);
    console.log(
      `Making translation request with ${messages.length} messages (model: ${model}, temperature: ${temperature})`,
    );

    // Decide streaming behavior: always honor explicit client streaming requests.
    // Server config can still enable upstream streaming for non-streaming clients.
    const streamToClient = !!request.useStreaming;
    const streamFromUpstream = streamToClient || serverConfig.translationUseStreaming;

    if (streamToClient) {
      // Client wants streaming - pass through the stream directly
      try {
        const response = await axios.post(
          url,
          {
            model,
            messages,
            temperature,
            max_tokens: maxOutputTokens,
            stream: true,
            stream_options: { include_usage: true },
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
            responseType: 'stream',
          },
        );

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        const stream: NodeJS.ReadableStream = response.data;
        
        // Send initial metadata
        res.write(`data: ${JSON.stringify({ 
          type: 'metadata', 
          sourceLanguage: novel.sourceLanguage,
          targetLanguage: novel.targetLanguage,
          tokenCounts,
          postprocessOptions,
        })}\n\n`);

        stream.on('data', (chunk: Buffer) => {
          res.write(chunk);
        });

        stream.on('end', () => {
          res.end();
        });

        stream.on('error', (err) => {
          console.error('Stream error:', err);
          res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
          res.end();
        });

      } catch (error) {
        console.error('Streaming request failed:', error);
        if (!res.headersSent) {
          const status = axios.isAxiosError(error)
            ? error.response?.status ?? 500
            : 500;
          return res.status(status).json({ message: 'Streaming request failed' });
        }
        return res.end();
      }
    } else if (streamFromUpstream) {
      // Server wants to stream from upstream but client doesn't want streaming
      // Collect the streamed response and return as JSON
      try {
        const streamResult = await makeStreamingTranslationRequest(
          url,
          messages,
          model,
          temperature,
          apiKey,
          maxOutputTokens,
        );

        const translation = streamResult.content;
        const tokenUsage = streamResult.usage;
        const finishReason = streamResult.finishReason;
        console.log('translation response (streamed, collected)', {
          usage: tokenUsage,
          finishReason,
          contentLength: translation.length,
        });

        // Extract toolcalls, then post-process translation text
        const { translation: strippedTranslation, toolcalls } = extractToolcallsAndStrip(translation);
        const normalizedToolCalls = normalizeToolCalls(toolcalls);
        const postProcessedTranslation = postProcessTranslation(strippedTranslation, postprocessOptions);

        // Return the translation along with the novel's language settings for quality check
        return res.status(200).json({
          translation: postProcessedTranslation,
          toolCalls: normalizedToolCalls,
          tokenUsage: tokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          sourceLanguage: novel.sourceLanguage,
          targetLanguage: novel.targetLanguage,
          tokenCounts: {
            system: tokenCounts.system,
            task: tokenCounts.task,
            translation: tokenCounts.translation,
          },
          finishReason,
        });

      } catch (error) {
        console.error('Streaming request failed:', error);
        return res.status(500).json({ message: 'Streaming request failed' });
      }
    } else {
      // Non-streaming from upstream
      let apiResponse = await makeTranslationRequest(
        url,
        messages,
        model,
        temperature,
        apiKey,
        maxOutputTokens,
      );

      if (apiResponse.data.choices[0].finish_reason === 'length') {
        console.log('Hit length limit, retrying with the same parameters...');
        apiResponse = await makeTranslationRequest(
          url,
          messages,
          model,
          temperature,
          apiKey,
          maxOutputTokens,
        );
      }

      const translation = apiResponse.data.choices[0].message.content;
      const tokenUsage = apiResponse.data.usage;
      const finishReason = apiResponse.data.choices[0].finish_reason;
      console.log('translation response', {
        responseHeaders: apiResponse.headers,
        responseBody: apiResponse.data,
        usage: tokenUsage,
        finishReason,
        safetyResults: JSON.stringify(apiResponse.data.vertex_ai_safety_results),
      });

      // Extract toolcalls, then post-process translation text
      const { translation: strippedTranslation, toolcalls } = extractToolcallsAndStrip(translation);
      const normalizedToolCalls = normalizeToolCalls(toolcalls);
      const postProcessedTranslation = postProcessTranslation(strippedTranslation, postprocessOptions);

      // Return the translation along with the novel's language settings for quality check
      return res.status(200).json({
        translation: postProcessedTranslation,
        toolCalls: normalizedToolCalls,
        tokenUsage: tokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
        tokenCounts: {
          system: tokenCounts.system,
          task: tokenCounts.task,
          translation: tokenCounts.translation,
        },
        finishReason,
      });
    }
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

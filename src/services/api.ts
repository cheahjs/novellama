import axios from 'axios';
import { QualityCheckResponse, TranslationPostprocessOptions, TranslationResponse } from '@/types';
import { postProcessTranslation } from '@/utils/postProcessTranslation';
import { normalizeToolCalls } from '@/utils/toolCalls';
import { extractToolcallsAndStrip } from '@/utils/extractToolcalls';

type MinimalTranslationRequest = {
  sourceContent: string;
  novelId: string;
  currentChapterId?: string;
  previousTranslation?: string;
  qualityFeedback?: string;
  useImprovementFeedback?: boolean;
  onUpdate?: (partial: string) => void;
};

type StreamingTokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type StreamingTokenCounts = Record<string, number | undefined>;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) break;
      
      const backoffDelay = baseDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms...`);
      await delay(backoffDelay);
    }
  }
  
  throw lastError;
};

export const translateContent = async (
  request: MinimalTranslationRequest & {
    onUpdate?: (partial: string) => void;
  },
): Promise<TranslationResponse> => {
  try {
    // Make API call to server endpoint which will handle message construction
    const response = await retryWithBackoff(async () => {
      if (request.onUpdate) {
        // Use fetch for streaming
        const resp = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let translation = '';
        let buffer = '';
        let tokenUsage: StreamingTokenUsage = {};
        let tokenCounts: StreamingTokenCounts = {};
        let sourceLanguage = '';
        let targetLanguage = '';
        let finishReason = null;
        let streamingPostprocessOptions: TranslationPostprocessOptions | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice('data:'.length).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              
              if (parsed.type === 'metadata') {
                sourceLanguage = parsed.sourceLanguage;
                targetLanguage = parsed.targetLanguage;
                tokenCounts = parsed.tokenCounts ?? {};
                streamingPostprocessOptions = parsed.postprocessOptions;
                continue;
              }

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              const choice = parsed.choices?.[0];
              const deltaContent = choice?.delta?.content;
              
              if (typeof deltaContent === 'string') {
                translation += deltaContent;
                request.onUpdate?.(translation);
              }

              if (parsed.usage) {
                tokenUsage = parsed.usage;
              }
              
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }

        // Construct a response object similar to axios response
        return {
          data: {
            translation,
            tokenUsage,
            tokenCounts,
            sourceLanguage,
            targetLanguage,
            finishReason,
            toolCalls: null, // Tool calls parsing logic needed if we want to support it in streaming
            postprocessOptions: streamingPostprocessOptions,
          }
        };
      } else {
        // Fallback to axios for non-streaming
        const resp = await axios.post('/api/translate', request);
        return resp;
      }
    });

    const translatedContent = response.data.translation;
    // For streaming, we might need to parse tool calls from the full content if they were streamed
    // But for now let's assume tool calls are not critical for streaming or are handled differently
    // Actually, the API returns tool calls in the JSON response for non-streaming.
    // For streaming, we receive the raw text which might contain the tool calls block.
    // We should probably parse it here if we want to support it.
    
    let toolCallsPayload = response.data.toolCalls;
    let finalTranslation = translatedContent;

    if (request.onUpdate) {
      // Parse tool calls from the final translation if it was streamed
      // Use heuristics to handle malformed/unclosed code blocks
      const { translation: stripped, toolcalls } = extractToolcallsAndStrip(translatedContent);
      if (toolcalls.length > 0) {
        toolCallsPayload = toolcalls;
      }
      finalTranslation = stripped;
    }

    const postprocessOptions = response.data
      .postprocessOptions as TranslationPostprocessOptions | undefined;
    const shouldPostprocessClientSide = Boolean(request.onUpdate && postprocessOptions);

    if (shouldPostprocessClientSide) {
      const processed = postProcessTranslation(finalTranslation, postprocessOptions);
      if (processed !== finalTranslation) {
        request.onUpdate?.(processed);
      }
      finalTranslation = processed;
    }

    const tokenUsage = response.data.tokenUsage;
    const tokenCounts = response.data.tokenCounts;

    // Perform quality check with retry
    const qualityCheckResponse = await retryWithBackoff(() => 
      checkTranslationQuality({
        sourceContent: request.sourceContent,
        translatedContent: finalTranslation,
        sourceLanguage: response.data.sourceLanguage,
        targetLanguage: response.data.targetLanguage,
        novelId: request.novelId,
      })
    );

    return {
      translatedContent: finalTranslation,
      tokenUsage: {
        native_prompt: tokenUsage?.prompt_tokens || 0,
        native_completion: tokenUsage?.completion_tokens || 0,
        system: tokenCounts?.system || 0,
        task: tokenCounts?.task || 0,
        translation: tokenCounts?.translation || 0,
      },
      qualityCheck: qualityCheckResponse,
      toolCalls: normalizeToolCalls(toolCallsPayload),
    };
  } catch (error) {
    console.error('Translation error after retries:', error);
    throw new Error('Failed to translate content after multiple attempts');
  }
};

export const checkTranslationQuality = async ({
  sourceContent,
  translatedContent,
  sourceLanguage,
  targetLanguage,
  novelId,
}: {
  sourceContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  novelId?: string;
}): Promise<QualityCheckResponse> => {
  try {
    const response = await retryWithBackoff(async () => {
      const resp = await axios.post('/api/quality-check', {
        sourceContent,
        translatedContent,
        sourceLanguage,
        targetLanguage,
        novelId,
      });
      return resp;
    });

    return response.data;
  } catch (error) {
    console.error('Quality check error after retries:', error);
    return {
      isGoodQuality: true, // Default to true to not block the flow
      score: 0,
      feedback: 'Quality check failed after multiple attempts. Please review manually.',
    };
  }
};

import axios from 'axios';
import { QualityCheckResponse, TranslationResponse } from '@/types';

type MinimalTranslationRequest = {
  sourceContent: string;
  novelId: string;
  currentChapterId?: string;
  previousTranslation?: string;
  qualityFeedback?: string;
  useImprovementFeedback?: boolean;
};

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
  request: MinimalTranslationRequest,
): Promise<TranslationResponse> => {
  try {
    // Make API call to server endpoint which will handle message construction
    const response = await retryWithBackoff(async () => {
      const resp = await axios.post('/api/translate', request);
      return resp;
    });

    const translatedContent = response.data.translation;
    const tokenUsage = response.data.tokenUsage;
    const tokenCounts = response.data.tokenCounts;

    // Perform quality check with retry
    const qualityCheckResponse = await retryWithBackoff(() => 
      checkTranslationQuality({
        sourceContent: request.sourceContent,
        translatedContent,
        sourceLanguage: response.data.sourceLanguage,
        targetLanguage: response.data.targetLanguage,
      })
    );

    return {
      translatedContent,
      tokenUsage: {
        native_prompt: tokenUsage.prompt_tokens,
        native_completion: tokenUsage.completion_tokens,
        system: tokenCounts.system,
        task: tokenCounts.task,
        translation: tokenCounts.translation,
      },
      qualityCheck: qualityCheckResponse,
    };
  } catch (error) {
    console.error('Translation error after retries:', error);
    throw new Error('Failed to translate content after multiple attempts');
  }
};

export type StreamTranslateHandlers = {
  onMeta?: (meta: {
    sourceLanguage: string;
    targetLanguage: string;
    tokenCounts: { system: number; task: number; translation: number };
    model: string;
    temperature: number;
  }) => void;
  onReasoningDelta?: (text: string) => void;
  onContentDelta?: (text: string) => void;
  onUsage?: (usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) => void;
  onError?: (message: string) => void;
};

export const streamTranslateContent = async (
  request: MinimalTranslationRequest,
  handlers: StreamTranslateHandlers,
  options?: { signal?: AbortSignal },
): Promise<TranslationResponse> => {
  const response = await fetch('/api/translate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: options?.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to start streaming translation: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let translatedContent = '';
  let tokenCounts: { system: number; task: number; translation: number } = {
    system: 0,
    task: 0,
    translation: 0,
  };
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  // Final event is optional; we aggregate deltas as the source of truth

  const processEventBlock = (block: string) => {
    const lines = block.split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice('data:'.length).trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        switch (evt.type) {
          case 'meta':
            tokenCounts = evt.tokenCounts ?? tokenCounts;
            handlers.onMeta?.(evt);
            break;
          case 'reasoning_delta':
            if (typeof evt.text === 'string') handlers.onReasoningDelta?.(evt.text);
            break;
          case 'content_delta':
            if (typeof evt.text === 'string') {
              translatedContent += evt.text;
              handlers.onContentDelta?.(evt.text);
            }
            break;
          case 'usage':
            if (evt.usage) {
              usage = evt.usage;
              handlers.onUsage?.(usage);
            }
            break;
          case 'final':
            if (typeof evt.translatedContent === 'string') {
              translatedContent = evt.translatedContent;
            }
            if (evt.tokenCounts) {
              tokenCounts = evt.tokenCounts;
            }
            if (evt.usage) {
              usage = evt.usage;
            }
            break;
          case 'error':
            if (evt.message) handlers.onError?.(evt.message);
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const eventBlock = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      processEventBlock(eventBlock);
    }
  }

  if (buffer.length > 0) {
    processEventBlock(buffer);
  }

  const finalTranslated = translatedContent;
  const tc = tokenCounts;
  const usg = usage;

  return {
    translatedContent: finalTranslated,
    tokenUsage: {
      native_prompt: usg.prompt_tokens || 0,
      native_completion: usg.completion_tokens || 0,
      system: tc.system,
      task: tc.task,
      translation: tc.translation,
    },
  };
};

export const checkTranslationQuality = async ({
  sourceContent,
  translatedContent,
  sourceLanguage,
  targetLanguage,
}: {
  sourceContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<QualityCheckResponse> => {
  try {
    const response = await retryWithBackoff(async () => {
      const resp = await axios.post('/api/quality-check', {
        sourceContent,
        translatedContent,
        sourceLanguage,
        targetLanguage,
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

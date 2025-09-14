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
        novelId: request.novelId,
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

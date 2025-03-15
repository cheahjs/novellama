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

export const translateContent = async (
  request: MinimalTranslationRequest,
): Promise<TranslationResponse> => {
  try {
    // Make API call to server endpoint which will handle message construction
    const response = await axios.post('/api/translate', request);

    const translatedContent = response.data.translation;
    const tokenUsage = response.data.tokenUsage;
    const tokenCounts = response.data.tokenCounts;

    // Perform quality check
    const qualityCheckResponse = await checkTranslationQuality({
      sourceContent: request.sourceContent,
      translatedContent,
      sourceLanguage: response.data.sourceLanguage,
      targetLanguage: response.data.targetLanguage,
    });

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
    console.error('Translation error:', error);
    throw new Error('Failed to translate content');
  }
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
    const response = await axios.post('/api/quality-check', {
      sourceContent,
      translatedContent,
      sourceLanguage,
      targetLanguage,
    });

    return response.data;
  } catch (error) {
    console.error('Quality check error:', error);
    return {
      isGoodQuality: true, // Default to true to not block the flow
      score: 0,
      feedback: 'Quality check failed. Please review manually.',
    };
  }
};

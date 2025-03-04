import axios from 'axios';
import { TranslationRequest, TranslationResponse } from '@/types';
import { truncateContext } from '@/utils/tokenizer';

export const translateContent = async (request: TranslationRequest): Promise<TranslationResponse> => {
  try {
    // Prepare context
    let context = [];
    
    if (request.previousChunks && request.previousChunks.length > 0) {
      // Limit context to avoid token limits
      const limitedChunks = truncateContext(request.previousChunks, 4000, 10);
      
      // Format previous chunks as context
      context = limitedChunks.map(chunk => ({
        role: 'assistant',
        content: `Source: ${chunk.sourceContent}\nTranslation: ${chunk.translatedContent}`
      }));
    }
    
    // Prepare references if provided
    const referencesText = request.references.length > 0
      ? "References:\n" + request.references.join("\n\n")
      : "";
    
    // Create messages for the API call
    const messages = [
      {
        role: 'system',
        content: `${request.systemPrompt}\n\n${referencesText}`
      },
      ...context,
      {
        role: 'user',
        content: `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}:\n\n${request.sourceContent}`
      }
    ];
    
    // Make API call to OpenAI-compatible endpoint
    const response = await axios.post('/api/translate', { messages });
    
    return {
      translatedContent: response.data.translation
    };
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Failed to translate content');
  }
}

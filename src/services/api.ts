import axios from 'axios';
import { TranslationRequest, TranslationResponse } from '@/types';
import { truncateContext } from '@/utils/tokenizer';
import { processReferences, calculateTotalReferenceTokens } from '@/utils/referenceUtils';
import { countTokens } from '@/utils/tokenizer';

export const translateContent = async (request: TranslationRequest): Promise<TranslationResponse> => {
  try {
    // Prepare context
    let context = [];
    let contextTokens = 0;
    
    if (request.previousChunks && request.previousChunks.length > 0) {
      // Limit context to avoid token limits
      const limitedChunks = await truncateContext(request.previousChunks, 4000, 10);
      
      // Format previous chunks as context
      context = limitedChunks.map(chunk => ({
        role: 'assistant',
        content: `Source: ${chunk.sourceContent}\nTranslation: ${chunk.translatedContent}`
      }));
      
      // Count tokens in context
      for (const contextItem of context) {
        contextTokens += await countTokens(contextItem.content);
      }
    }
    
    // Process references to respect token limits
    const processedReferences = await processReferences(request.references);
    const referenceTokens = calculateTotalReferenceTokens(processedReferences);
    
    // Format references with titles
    const referencesText = processedReferences.length > 0
      ? "References:\n" + processedReferences.map(ref => 
          `## ${ref.title} (${ref.tokenCount} tokens)\n${ref.content}`
        ).join("\n\n")
      : "";
    
    // Count input tokens
    const systemPromptTokens = await countTokens(request.systemPrompt);
    const sourceContentTokens = await countTokens(request.sourceContent);
    const inputTokens = systemPromptTokens + sourceContentTokens;
    
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
    
    // Count output tokens
    const outputTokens = await countTokens(response.data.translation);
    
    // Calculate total token usage
    const totalTokens = referenceTokens + contextTokens + inputTokens + outputTokens;
    
    return {
      translatedContent: response.data.translation,
      tokenUsage: {
        total: totalTokens,
        references: referenceTokens,
        context: contextTokens,
        input: inputTokens,
        output: outputTokens
      }
    };
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Failed to translate content');
  }
}

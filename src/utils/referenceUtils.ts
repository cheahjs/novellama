import { Reference } from '@/types';
import { countTokens } from './tokenizer';

/**
 * Processes references to ensure they don't exceed token limits
 * This is important for large reference texts like wiki pages
 */
export async function processReferences(
  references: Reference[],
  maxTokensPerReference: number = 1000
): Promise<Reference[]> {
  if (!references || references.length === 0) return [];
  
  const processedReferences: Reference[] = [];
  
  for (const reference of references) {
    // Deep copy to avoid mutations
    const processedRef = { ...reference };
    
    // Count tokens in the reference content
    const tokenCount = await countTokens(reference.content);
    
    // Add the token count to the reference
    processedRef.tokenCount = tokenCount;
    
    // If content exceeds the token limit, truncate it
    if (tokenCount > maxTokensPerReference) {
      // Simple truncation - in a real app you might want to be smarter about this
      // For example, cutting at sentence boundaries or summarizing the content
      const ratio = maxTokensPerReference / tokenCount;
      const estimatedChars = Math.floor(reference.content.length * ratio) - 100; // Subtract a buffer
      
      processedRef.content = reference.content.substring(0, estimatedChars) + 
        "\n\n[Content truncated due to length. This is a partial reference.]";
      
      // Update the token count after truncation
      processedRef.tokenCount = await countTokens(processedRef.content);
    }
    
    processedReferences.push(processedRef);
  }
  
  return processedReferences;
}

/**
 * Extracts key information from a reference that might be most useful 
 * for translation context (e.g., terminology, names, etc.)
 */
export function extractKeyInformation(reference: Reference): string {
  // This is a placeholder for more sophisticated extraction logic
  // In a real application, you might want to use NLP to extract key terms,
  // named entities, or other important information
  
  return reference.content;
}

/**
 * Creates a new reference object with the given title and content
 */
export async function createReference(title: string, content: string): Promise<Reference> {
  const tokenCount = await countTokens(content);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    title,
    content,
    tokenCount
  };
}

/**
 * Calculates the total token count for all references
 */
export function calculateTotalReferenceTokens(references: Reference[]): number {
  return references.reduce((total, ref) => {
    return total + (ref.tokenCount || 0);
  }, 0);
}

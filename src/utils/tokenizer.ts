import { AutoTokenizer, PreTrainedTokenizer } from '@xenova/transformers';

// Properly typed encoder using transformers.js types
type Encoder = PreTrainedTokenizer;

let encoder: Encoder | null = null;

export async function initTokenizer(): Promise<Encoder | null> {
  if (!encoder) {
    try {
      // Get model name from environment or use default
      const modelName = process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o';
      encoder = await AutoTokenizer.from_pretrained(modelName);
    } catch (error) {
      console.error('Error initializing tokenizer:', error);
    }
  }
  return encoder;
}

export async function countTokens(text: string): Promise<number> {
  const enc = await initTokenizer();
  if (!enc) return 0;
  
  const result = await enc.encode(text);
  return result.length;
}

export async function truncateContext<T>(
  chunks: T[],
  maxTokens: number = 4000,
  maxChunks: number | null = null
): Promise<T[]> {
  if (chunks.length === 0) return [];
  
  // First, apply the maxChunks limit if specified
  if (maxChunks && chunks.length > maxChunks) {
    return chunks.slice(chunks.length - maxChunks);
  }
  
  const enc = await initTokenizer();
  if (!enc) return chunks; // If no encoder is available, return all chunks
  
  // Check if chunks are chat messages with role and content
  const isChatMessages = chunks.length > 0 && 
    typeof chunks[0] === 'object' && 
    chunks[0] !== null &&
    'role' in chunks[0] && 
    'content' in chunks[0];
  
  // If these are chat messages, use apply_chat_template for accurate counting
  if (isChatMessages) {
    // Cast to proper message format for apply_chat_template
    const messages = chunks as unknown as Array<{role: string, content: string}>;
    
    // Start from the most recent and go backwards
    let startIdx = 0;
    for (let i = chunks.length; i > 0; i--) {
      const contextChunks = messages.slice(chunks.length - i);
      
      // Use apply_chat_template for accurate token counting
      const tokenCount = enc.apply_chat_template(contextChunks, { 
        tokenize: true,
        return_tensor: false 
      }).length;
      
      if (tokenCount <= maxTokens) {
        startIdx = chunks.length - i;
        break;
      }
    }
    
    return chunks.slice(startIdx);
  } else {
    // Original approach for non-chat messages
    let totalTokens = 0;
    let startIdx = 0;
    
    // Start from the most recent and go backwards
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
      const chunkTokens = await countTokens(JSON.stringify(chunk));
      
      if (totalTokens + chunkTokens > maxTokens) {
        startIdx = i + 1;
        break;
      }
      
      totalTokens += chunkTokens;
    }
    
    return chunks.slice(startIdx);
  }
}

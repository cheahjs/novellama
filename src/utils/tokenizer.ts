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
  
  if (maxChunks && chunks.length > maxChunks) {
    return chunks.slice(chunks.length - maxChunks);
  }
  
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

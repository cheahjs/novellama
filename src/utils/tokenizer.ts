import { AutoTokenizer } from '@huggingface/transformers';
import type { PreTrainedTokenizer } from '@huggingface/transformers';
import assert from 'assert';
import { serverConfig } from '../../config';

let encoder: PreTrainedTokenizer | null = null;

export async function initTokenizer(): Promise<PreTrainedTokenizer> {
  if (!encoder) {
    try {
      // Get model name from server config (this file is only used server-side)
      const modelName = serverConfig.tokenizerModel;

      // Initialize tokenizer for server environment
      encoder = await AutoTokenizer.from_pretrained(modelName, {
        progress_callback: undefined,
        cache_dir: './data/cache',
      });
    } catch (error) {
      console.error('Error initializing tokenizer:', error);
      throw error; // Propagate the error to handle it upstream
    }
  }
  return encoder;
}

interface ChatMessage {
  role: string;
  content: string;
}

export async function countMessagesTokens(
  messages: ChatMessage[],
): Promise<number> {
  try {
    const tokenizer = await initTokenizer();

    // Count tokens for each message
    const tokenCounts = messages
      .map((message) => {
        const encoded = tokenizer.encode(message.content);
        return encoded.length;
      })
      .reduce((a, b) => a + b, 0);

    return tokenCounts;
  } catch (error) {
    console.error('Error counting tokens:', error);
    // Return a conservative estimate if tokenizer fails
    return messages.reduce(
      (acc, msg) => acc + Math.ceil(msg.content.length / 4),
      0,
    );
  }
}

export async function truncateContext(
  messages: { role: string; content: string }[],
  maxTokens: number = serverConfig.maxTokens,
): Promise<{
  messages: { role: string; content: string }[];
  tokenCounts: {
    system: number;
    task: number;
    translation: number;
    total: number;
  };
}> {
  if (messages.length === 0)
    return {
      messages: [],
      tokenCounts: { system: 0, task: 0, translation: 0, total: 0 },
    };

  // Start with system and task messages
  const baseMessages = [
    messages[0], // System prompt
    messages[1], // References
    messages[messages.length - 1], // Task
  ];
  const systemTokenCount = await countMessagesTokens([
    messages[0],
    messages[1],
  ]);
  const taskTokenCount = await countMessagesTokens([
    messages[messages.length - 1],
  ]);

  if (systemTokenCount + taskTokenCount > maxTokens) {
    throw new Error(
      `System and task token count is greater than max tokens (${systemTokenCount} + ${taskTokenCount} > ${maxTokens})`,
    );
  }

  // Get the translation messages
  const translationMessages = messages.slice(2, -1);
  assert(
    translationMessages.length % 2 === 0,
    'Translation messages must be in pairs',
  );
  const pairs = translationMessages.length / 2;

  // Binary search for the maximum number of pairs that fit
  let left = 0;
  let right = pairs;
  let bestCount = 0;
  let bestTokenCount = systemTokenCount + taskTokenCount;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const pairCount = mid;
    const testMessages = [
      ...baseMessages,
      ...translationMessages.slice(-pairCount * 2),
    ];

    const tokenCount = await countMessagesTokens(testMessages);

    if (tokenCount <= maxTokens) {
      if (pairCount > bestCount) {
        bestCount = pairCount;
        bestTokenCount = tokenCount;
      }
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Construct final result with the best fitting number of pairs
  const result = [
    baseMessages[0],
    baseMessages[1],
    ...translationMessages.slice(-bestCount * 2),
    baseMessages[2],
  ];

  return {
    messages: result,
    tokenCounts: {
      system: systemTokenCount,
      task: taskTokenCount,
      translation: bestTokenCount - systemTokenCount - taskTokenCount,
      total: bestTokenCount,
    },
  };
}

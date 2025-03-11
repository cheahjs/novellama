import { AutoTokenizer, PreTrainedTokenizer } from "@xenova/transformers";
import assert from "assert";

let encoder: PreTrainedTokenizer | null = null;

export async function initTokenizer(): Promise<PreTrainedTokenizer | null> {
  if (!encoder) {
    try {
      // Get model name from environment or use default
      const modelName = process.env.TOKENIZER_MODEL || "Xenova/gpt-4o";
      encoder = await AutoTokenizer.from_pretrained(modelName);
    } catch (error) {
      console.error("Error initializing tokenizer:", error);
    }
  }
  return encoder;
}

export async function countTokens(text: string): Promise<number> {
  const enc = await initTokenizer();
  if (!enc) {
    throw new Error("Tokenizer not initialized");
  }

  const result = enc.encode(text);
  return result.length;
}

export async function countMessagesTokens(
  messages: { role: string; content: string }[]
): Promise<number> {
  const enc = await initTokenizer();
  if (!enc) {
    throw new Error("Tokenizer not initialized");
  }
  console.log("encoding", {enc, messages})
  const result = enc.apply_chat_template(messages, {
    tokenize: true,
    return_tensor: false,
  });
  return (result as number[]).length;
}

export async function truncateContext(
  messages: { role: string; content: string }[],
  maxTokens: number = Number.parseInt(process.env.MAX_TOKENS ?? "16000")
): Promise<{
  messages: { role: string; content: string }[];
  tokenCounts: {
    system: number;
    task: number;
    translation: number;
  };
}> {
  if (messages.length === 0)
    return {
      messages: [],
      tokenCounts: { system: 0, task: 0, translation: 0 },
    };

  // Start with system and task messages
  const baseMessages = [
    messages[0], // System prompt
    messages[1], // References
    messages[messages.length - 1], // Task
  ];
  const systemTokenCount = await countMessagesTokens([messages[0], messages[1]]);
  const taskTokenCount = await countMessagesTokens([messages[messages.length - 1]]);

  if (systemTokenCount + taskTokenCount > maxTokens) {
    throw new Error("System and task token count is greater than max tokens");
  }

  // Get the translation messages
  const translationMessages = messages.slice(2, -1);
  assert(translationMessages.length % 2 === 0, "Translation messages must be in pairs");
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
      ...translationMessages.slice(-pairCount * 2)
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
    baseMessages[2]
  ];

  return {
    messages: result,
    tokenCounts: {
      system: systemTokenCount,
      task: taskTokenCount,
      translation: bestTokenCount - systemTokenCount - taskTokenCount
    },
  };
}

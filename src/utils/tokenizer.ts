import { AutoTokenizer, PreTrainedTokenizer } from "@xenova/transformers";
import assert from "assert";

// Properly typed encoder using transformers.js types
type Encoder = PreTrainedTokenizer;

let encoder: Encoder | null = null;

export async function initTokenizer(): Promise<Encoder | null> {
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
  };

  const result = enc.encode(text);
  return result.length;
}

export async function countMessagesTokens(messages: { role: string; content: string}[]): Promise<number> {
  const enc = await initTokenizer();
  if (!enc) return 0;

  const result = enc.apply_chat_template(messages, {
    tokenize: true,
    return_tensor: false,
  }) as number[];
  return result.length;
}

export async function truncateContext(
  messages: { role: string; content: string}[],
  maxTokens: number = Number.parseInt(process.env.MAX_TOKENS ?? "16000"),
): Promise<{
  messages: { role: string; content: string}[],
  tokenCounts: {
    system: number,
    task: number,
    translation: number,
  }
}> {
  if (messages.length === 0) return {
    messages: [],
    tokenCounts: {
      system: 0,
      task: 0,
      translation: 0,
    }
  };

  // Start with system and task messages
  const result = [
    messages[0], // System prompt
    messages[messages.length - 1], // Task
  ];
  const systemTokenCount = await countMessagesTokens([messages[0]]);
  const taskTokenCount = await countMessagesTokens([messages[messages.length - 1]]);

  if (systemTokenCount + taskTokenCount > maxTokens) {
    throw new Error("System and task token count is greater than max tokens");
  }

  // Get the translation messages
  const translationMessages = messages.slice(1, -1);

  // Add translation messages in pairs from most recent until we hit token limit
  assert(translationMessages.length % 2 === 0, "Translation messages must be in pairs");
  let totalTokenCount = 0;
  for (let i = translationMessages.length - 1; i >= 0; i -= 2 ) {
    const testChunks = [...result, translationMessages[i], translationMessages[i + 1]];
    const tokenCount = await countMessagesTokens(testChunks);
    if (tokenCount <= maxTokens) {
      result.splice(1, 0, translationMessages[i - 1], translationMessages[i]);
      totalTokenCount += tokenCount;
    } else {
      break;
    }
  }
  const translationTokenCount = totalTokenCount - systemTokenCount - taskTokenCount;

  return {
    messages: result,
    tokenCounts: {
      system: systemTokenCount,
      task: taskTokenCount,
      translation: translationTokenCount,
    }
  };
}

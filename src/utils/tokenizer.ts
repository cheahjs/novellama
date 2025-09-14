import { Worker } from 'worker_threads';
import assert from 'assert';
import { serverConfig } from '../../config';

interface WorkerMessage {
  id: number;
  type: string;
  payload?: unknown;
  result?: unknown;
  error?: string;
}

interface PendingMessage {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let messageId = 0;
const pendingMessages = new Map<number, PendingMessage>();

// Inline worker code as a string to avoid bundling issues
const workerCode = `
import { parentPort } from 'worker_threads';
import { AutoTokenizer } from '@huggingface/transformers';

let encoder = null;

async function initTokenizer(modelName, cacheDir) {
  console.log('Initializing tokenizer', modelName, cacheDir);
  if (!encoder) {
    try {
      encoder = await AutoTokenizer.from_pretrained(modelName, {
        progress_callback: undefined,
        cache_dir: cacheDir,
      });
    } catch (error) {
      throw new Error(\`Error initializing tokenizer: \${error.message}\`);
    }
  }
  return encoder;
}

async function countMessagesTokens(messages) {
  if (!encoder) {
    throw new Error('Tokenizer not initialized');
  }

  try {
    const tokenCounts = messages
      .map((message) => {
        const encoded = encoder.encode(message.content);
        return encoded.length;
      })
      .reduce((a, b) => a + b, 0);

    return tokenCounts;
  } catch {
    // Return a conservative estimate if tokenizer fails
    return messages.reduce(
      (acc, msg) => acc + Math.ceil(msg.content.length / 4),
      0,
    );
  }
}

// Handle messages from the main thread
parentPort.on('message', async (data) => {
  const { id, type, payload } = data;

  try {
    switch (type) {
      case 'init':
        await initTokenizer(payload.modelName, payload.cacheDir);
        parentPort.postMessage({ id, type: 'success', result: true });
        break;

      case 'countTokens':
        const tokenCount = await countMessagesTokens(payload.messages);
        parentPort.postMessage({ id, type: 'success', result: tokenCount });
        break;

      default:
        throw new Error(\`Unknown message type: \${type}\`);
    }
  } catch (err) {
    parentPort.postMessage({
      id,
      type: 'error',
      error: err.message,
    });
  }
});
`;

function createWorker(): Worker {
  // Create worker from inline code instead of file path
  const newWorker = new Worker(workerCode, { eval: true });
  
  newWorker.on('message', (data: WorkerMessage) => {
    const { id, type, result, error } = data;
    const pending = pendingMessages.get(id);
    
    if (pending) {
      pendingMessages.delete(id);
      if (type === 'success') {
        pending.resolve(result);
      } else if (type === 'error') {
        pending.reject(new Error(error || 'Unknown worker error'));
      }
    }
  });

  newWorker.on('error', (error) => {
    console.error('Worker error:', error);
    // Reject all pending messages
    for (const [id, pending] of pendingMessages.entries()) {
      pending.reject(new Error(`Worker error: ${error.message}`));
      pendingMessages.delete(id);
    }
  });

  return newWorker;
}

function sendWorkerMessage(type: string, payload: unknown): Promise<unknown> {
  if (!worker) {
    worker = createWorker();
  }

  const id = ++messageId;
  
  return new Promise((resolve, reject) => {
    pendingMessages.set(id, { resolve, reject });
    worker!.postMessage({ id, type, payload });
  });
}

export async function initTokenizer(): Promise<boolean> {
  try {
    const modelName = serverConfig.tokenizerModel;
    const cacheDir = './data/cache';
    
    await sendWorkerMessage('init', { modelName, cacheDir });
    return true;
  } catch (error) {
    console.error('Error initializing tokenizer:', error);
    throw error;
  }
}

interface ChatMessage {
  role: string;
  content: string;
}

export async function countMessagesTokens(
  messages: ChatMessage[],
): Promise<number> {
  try {
    // Ensure tokenizer is initialized
    await initTokenizer();
    
    // Send messages to worker for token counting
    const tokenCount = await sendWorkerMessage('countTokens', { messages });
    return typeof tokenCount === 'number' ? tokenCount : 0;
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

  // Greedily add translation pairs from the end until we hit the limit
  let bestCount = 0;
  let translationTokens = 0;
  let bestTokenCount = systemTokenCount + taskTokenCount;
  for (let i = translationMessages.length - 2; i >= 0; i -= 2) {
    const pair = [translationMessages[i], translationMessages[i + 1]];
    const pairTokens = await countMessagesTokens(pair);
    const projected = systemTokenCount + taskTokenCount + translationTokens + pairTokens;
    if (projected <= maxTokens) {
      translationTokens += pairTokens;
      bestCount += 1;
      bestTokenCount = projected;
    } else {
      break;
    }
  }

  if (pairs > 0 && bestCount === 0) {
    throw new Error(
      `No translation messages fit within max tokens (system+task=${systemTokenCount + taskTokenCount}, max=${maxTokens})`,
    );
  }

  // Construct final result with the best fitting number of pairs
  const result = [
    baseMessages[0],
    baseMessages[1],
    ...translationMessages.slice(
      translationMessages.length - bestCount * 2,
    ),
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

// Cleanup function to terminate the worker
export function terminateTokenizer(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    // Reject any pending messages
    for (const [id, pending] of pendingMessages.entries()) {
      pending.reject(new Error('Worker terminated'));
      pendingMessages.delete(id);
    }
  }
}

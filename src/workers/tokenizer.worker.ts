import { AutoTokenizer, PreTrainedTokenizer } from '@xenova/transformers';

let tokenizer: PreTrainedTokenizer | null = null;

// Message handler
self.onmessage = async (event) => {
  const { type, id, text, modelName } = event.data;

  try {
    switch (type) {
      case 'init':
        if (!tokenizer) {
          tokenizer = await AutoTokenizer.from_pretrained(modelName);
          self.postMessage({ type: 'init', id, success: true });
        }
        break;

      case 'count':
        if (!tokenizer) {
          self.postMessage({ 
            type: 'count', 
            id, 
            error: 'Tokenizer not initialized' 
          });
          return;
        }
        const result = tokenizer.encode(text);
        self.postMessage({ 
          type: 'count', 
          id, 
          count: result.length 
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
      type, 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}; 
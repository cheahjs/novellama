import { useEffect, useRef, useState, useCallback } from "react";

interface TokenizerState {
  isLoading: boolean;
  error: string | null;
  count: number | null;
}

let workerInstance: Worker | undefined;
let nextId = 1;

interface WorkerResult {
  error?: string;
  success?: boolean;
  count?: number;
}

const pendingRequests = new Map<number, (result: WorkerResult) => void>();
let isWorkerInitialized = false;
let initializationPromise: Promise<void> | null = null;
let isInitializing = false;

// Get the model name from environment variables
const TOKENIZER_MODEL =
  process.env.NEXT_PUBLIC_TOKENIZER_MODEL || "Xenova/gpt-4o";

// Debounce helper function
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};

export function useTokenizer(
  text: string,
  debounceMs: number = 500,
  modelName: string = TOKENIZER_MODEL
): TokenizerState {
  const [state, setState] = useState<TokenizerState>({
    isLoading: !isWorkerInitialized && !isInitializing,
    error: null,
    count: null,
  });

  const textRef = useRef(text);
  textRef.current = text;

  // Memoize the state update functions
  const handleError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, isLoading: false, error, count: null }));
  }, []);

  const handleSuccess = useCallback((count: number) => {
    setState((prev) => ({ ...prev, isLoading: false, error: null, count }));
  }, []);

  const handleInitSuccess = useCallback(() => {
    isWorkerInitialized = true;
    isInitializing = false;
    setState((prev) => ({ ...prev, isLoading: false, error: null }));
  }, []);

  // Store the debounced function in a ref so it persists across renders
  const debouncedCountRef = useRef<(text: string) => void>();

  useEffect(() => {
    // Initialize worker if it doesn't exist
    if (!workerInstance && !isInitializing) {
      if (!initializationPromise) {
        isInitializing = true;
        initializationPromise = new Promise<void>((resolve) => {
          try {
            workerInstance = new Worker(
              new URL("../workers/tokenizer.worker.ts", import.meta.url)
            );

            workerInstance.onmessage = (event) => {
              const { type, id, error, count, success } = event.data;
              const resolver = pendingRequests.get(id);
              if (!resolver) return;

              pendingRequests.delete(id);

              if (error) {
                resolver({ error });
              } else if (type === "init") {
                isWorkerInitialized = true;
                resolver({ success });
              } else if (type === "count") {
                resolver({ count });
              }
            };

            // Initialize the tokenizer
            const id = nextId++;
            const promise = new Promise<WorkerResult>((resolve) => {
              pendingRequests.set(id, resolve);
            });
            workerInstance.postMessage({ type: "init", id, modelName });

            promise.then((result: WorkerResult) => {
              if (result.error) {
                handleError(result.error);
              } else {
                handleInitSuccess();
              }
              resolve();
            });
          } catch (error) {
            handleError(
              error instanceof Error
                ? error.message
                : "Failed to initialize tokenizer"
            );
            resolve();
          }
        });
      }

      // Wait for initialization to complete
      initializationPromise.then(() => {
        debouncedCountRef.current?.(textRef.current);
      });
    } else if (isWorkerInitialized) {
      debouncedCountRef.current?.(textRef.current);
      handleInitSuccess();
    }

    return () => {
      if (document.visibilityState === "hidden") {
        workerInstance?.terminate();
        workerInstance = undefined;
        isWorkerInitialized = false;
        initializationPromise = null;
      }
    };
  }, [modelName, handleError, handleInitSuccess]);

  // Initialize the debounced count function
  useEffect(() => {
    const countTokens = async (text: string) => {
      if (!workerInstance || state.isLoading || state.error) return;

      try {
        const id = nextId++;
        const promise = new Promise<WorkerResult>((resolve) => {
          pendingRequests.set(id, resolve);
        });

        workerInstance.postMessage({ type: "count", id, text });

        const result = await promise;
        if (result.error) {
          handleError(result.error);
        } else if (result.count !== undefined) {
          // Only update state if the text hasn't changed
          if (textRef.current === text) {
            handleSuccess(result.count);
          }
        }
      } catch (error) {
        handleError(
          error instanceof Error ? error.message : "Failed to count tokens"
        );
      }
    };

    // Create a new debounced function when debounceMs changes
    debouncedCountRef.current = debounce(countTokens, debounceMs);

    // Cleanup the previous debounced function
    return () => {
      if (debouncedCountRef.current) {
        // @ts-ignore - TypeScript doesn't know about the internal timer
        clearTimeout(debouncedCountRef.current.timer);
      }
    };
  }, [debounceMs, state.isLoading, state.error, handleError, handleSuccess]);

  // Call the debounced function when text changes
  useEffect(() => {
    if (debouncedCountRef.current) {
      debouncedCountRef.current(text);
    }
  }, [text]);

  return state;
}

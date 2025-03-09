# Novellama

Novellama is a web app designed to help translate web novels into another language using LLMs.

## Configuration

Environment variables:

- `OPENAI_BASE_URL`: The base URL for the OpenAI-compatible API. Default is `https://api.openai.com/v1`.
- `OPENAI_MODEL`: The model to use for the OpenAI-compatible API. Default is `gpt-4o`.
- `OPENAI_API_KEY`: The API key for the OpenAI-compatible API.
- `MAX_TOKENS`: The maximum number of tokens to use for the OpenAI-compatible API. Default is `16000`.
- `TOKENIZER_MODEL`: The tokenizer model on HuggingFace to use with transformers.js for counting tokens. Default is `Xenova/gpt-4o`.

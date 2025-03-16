# Novellama

![Icon](./public/icon.png)

Novellama is a web app designed to help translate web novels into another language using LLMs.

It is currently specifically designed for translating web novels from [Syoyetsu](https://syosetu.com/).

## Configuration

Environment variables:

- `OPENAI_BASE_URL`: The base URL for the OpenAI-compatible API. Default is `https://api.openai.com/v1`.
- `OPENAI_API_KEY`: The API key for the OpenAI-compatible API.
- `TRANSLATION_MODEL`: The model to use for translation using the OpenAI-compatible API. Default is `gpt-4o-mini`.
- `QUALITY_CHECK_MODEL`: The model to use for quality check using the OpenAI-compatible API. Default is `gpt-4o`. Must support structured output.
- `TRANSLATION_TEMPERATURE`: The temperature to use for translation. Default is `0.1`.
- `QUALITY_CHECK_TEMPERATURE`: The temperature to use for quality check. Default is `0.1`.
- `MAX_TOKENS`: The maximum number of tokens to use for the OpenAI-compatible API. Default is `16000`.
- `TOKENIZER_MODEL`: The tokenizer model on HuggingFace to use with transformers.js for counting tokens. Default is `Xenova/gpt-4o`.

The translations have been tested using `gemini-2.0-flash` as the translation model and `gemini-2.0-pro-exp-02-05` as the quality check model.

## Development

```bash
npm install
npm run dev
```

## Notes

This is an experiment with "vibe-coding", and as such code quality is on the lower end.
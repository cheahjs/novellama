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
- `MAX_TRANSLATION_OUTPUT_TOKENS`: Max tokens for the translation response. Default is `8000`.
- `MAX_QUALITY_CHECK_OUTPUT_TOKENS`: Max tokens for the quality check response. Defaults to `MAX_TRANSLATION_OUTPUT_TOKENS` when unset.
- `TRANSLATION_USE_STREAMING`: Enable streaming translation responses. Default is `false`.
- `TRANSLATION_POSTPROCESS_REMOVE_XML_TAGS`: Remove XML-like tags from translations. Default is `true`.
- `TRANSLATION_POSTPROCESS_REMOVE_CODE_BLOCKS`: Remove markdown code blocks from translations. Default is `true`.
- `TRANSLATION_POSTPROCESS_TRIM_WHITESPACE`: Trim whitespace. Default is `true`.
- `TRANSLATION_POSTPROCESS_TRUNCATE_AFTER_SECOND_HEADER`: Truncate after a second title header. Default is `true`.

Feature flags:

- `ENABLE_MODEL_CONFIG` (boolean): When `true`, enables setting per-novel overrides for model selection and token limits via the Novel Settings UI. When disabled, global env values are always used.

Per-novel overrides (when `ENABLE_MODEL_CONFIG=true`):

- Translation model and quality check model can be set on each novel (leave blank to inherit global env values).
- Token limits can also be set per novel:
  - `Max Context Tokens` (used for truncating previous-chapter context)
  - `Max Translation Output Tokens`
  - `Max Quality Check Output Tokens`

The translations have been tested using `gemini-2.0-flash` as the translation model and `gemini-2.0-pro-exp-02-05` as the quality check model.

## Development

```bash
npm install
npm run dev
```

## Notes

This is an experiment with "vibe-coding", and as such code quality is on the lower end.
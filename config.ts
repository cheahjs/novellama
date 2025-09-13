// Server-side only configuration
export const serverConfig = {
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  translationModel: process.env.TRANSLATION_MODEL || 'gpt-4o-mini',
  qualityCheckModel: process.env.QUALITY_CHECK_MODEL || 'gpt-4o',
  translationTemperature: Number(process.env.TRANSLATION_TEMPERATURE || '0.1'),
  qualityCheckTemperature: Number(
    process.env.QUALITY_CHECK_TEMPERATURE || '0.1',
  ),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  maxTokens: Number(process.env.MAX_TOKENS || '16000'),
  tokenizerModel: process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o',
  maxTranslationOutputTokens: Number(process.env.MAX_TRANSLATION_OUTPUT_TOKENS || '8000'),
  maxQualityCheckOutputTokens: Number(process.env.MAX_QUALITY_CHECK_OUTPUT_TOKENS || process.env.MAX_TRANSLATION_OUTPUT_TOKENS || '8000'),
  translationUseStreaming:
    (process.env.TRANSLATION_USE_STREAMING || '').toLowerCase() === 'true' ||
    process.env.TRANSLATION_USE_STREAMING === '1',
};

// Type definitions
export type ServerConfig = typeof serverConfig;

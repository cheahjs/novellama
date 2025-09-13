// Server-side only configuration
function getEnvBoolean(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

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
  translationUseStreaming: getEnvBoolean('TRANSLATION_USE_STREAMING', false),
  // Post-processing toggles (default to true for backward compatibility)
  postprocessRemoveXmlTags: getEnvBoolean('TRANSLATION_POSTPROCESS_REMOVE_XML_TAGS', true),
  postprocessRemoveCodeBlocks: getEnvBoolean('TRANSLATION_POSTPROCESS_REMOVE_CODE_BLOCKS', true), 
  postprocessTrimWhitespace: getEnvBoolean('TRANSLATION_POSTPROCESS_TRIM_WHITESPACE', true),
  postprocessTruncateAfterSecondHeader: getEnvBoolean('TRANSLATION_POSTPROCESS_TRUNCATE_AFTER_SECOND_HEADER', true),
};

// Type definitions
export type ServerConfig = typeof serverConfig;

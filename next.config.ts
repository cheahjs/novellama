import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: true,
  env: {
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    TRANSLATION_MODEL: process.env.TRANSLATION_MODEL || 'gpt-4o-mini',
    QUALITY_CHECK_MODEL: process.env.QUALITY_CHECK_MODEL || 'gpt-4o',
    TRANSLATION_TEMPERATURE: process.env.TRANSLATION_TEMPERATURE || '0.1',
    QUALITY_CHECK_TEMPERATURE: process.env.QUALITY_CHECK_TEMPERATURE || '0.1',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    MAX_TOKENS: process.env.MAX_TOKENS ?? '16000',
  },
  // Public environment variables that are accessible in the browser
  publicRuntimeConfig: {
    NEXT_PUBLIC_TOKENIZER_MODEL: process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o',
    NEXT_PUBLIC_MAX_TOKENS: process.env.MAX_TOKENS ?? '16000',
  },
  webpack: (config) => {
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default nextConfig;

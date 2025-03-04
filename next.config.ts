import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    OPENAI_BASE_URL: process.env.LLM_API_URL || 'https://api.openai.com/v1',
    OPENAI_MODEL: process.env.LLM_MODEL || 'gpt-4o',
    OPENAI_API_KEY: process.env.LLM_API_KEY || '',
    TOKENIZER_MODEL: process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o',
  }
};

export default nextConfig;

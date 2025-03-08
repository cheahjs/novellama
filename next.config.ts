import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: true,
  env: {
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    MAX_TOKENS: process.env.MAX_TOKENS ?? "16000",
  },
  // Public environment variables that are accessible in the browser
  publicRuntimeConfig: {
    NEXT_PUBLIC_TOKENIZER_MODEL: process.env.TOKENIZER_MODEL || "Xenova/gpt-4o",
    NEXT_PUBLIC_MAX_TOKENS: process.env.MAX_TOKENS ?? "16000",
  },
  webpack: (config) => {
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;

import nextConfig from 'eslint-config-next';
import nextCoreWebVitalsConfig from 'eslint-config-next/core-web-vitals';
import nextTypescriptConfig from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const config = [
  ...nextConfig,
  ...nextTypescriptConfig,
  ...nextCoreWebVitalsConfig,
  prettierConfig,
];

export default config;

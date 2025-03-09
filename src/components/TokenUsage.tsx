import React from 'react';
import { TranslationResponse } from '@/types';

interface TokenUsageProps {
  tokenUsage: NonNullable<TranslationResponse['tokenUsage']>;
  className?: string;
}

const TokenUsage: React.FC<TokenUsageProps> = ({ tokenUsage, className = '' }) => {
  return (
    <div className={`text-xs text-gray-400 ${className}`}>
      <div className="flex space-x-4">
        <div>System: {tokenUsage.system}</div>
        <div>Task: {tokenUsage.task}</div>
        <div>Translation: {tokenUsage.translation}</div>
        <div>Prompt: {tokenUsage.native_prompt}</div>
        <div>Completion: {tokenUsage.native_completion}</div>
        <div>Total: {tokenUsage.native_prompt + tokenUsage.native_completion}</div>
      </div>
    </div>
  );
};

export default TokenUsage;

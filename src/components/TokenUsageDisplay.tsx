import React from 'react';
import { Reference } from '@/types';

interface TokenUsageDisplayProps {
  references?: Reference[];
  contextTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  references = [],
  contextTokens = 0,
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
}) => {
  const referenceTokens = references.reduce((sum, ref) => sum + (ref.tokenCount || 0), 0);
  
  return (
    <div className="token-usage-display p-4 border rounded-lg bg-gray-50 my-4">
      <h3 className="font-semibold text-lg mb-2">Token Usage</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm">Total Tokens:</div>
        <div className="text-sm font-medium">{totalTokens.toLocaleString()}</div>
        
        <div className="text-sm">References:</div>
        <div className="text-sm font-medium">{referenceTokens.toLocaleString()}</div>
        
        <div className="text-sm">Context:</div>
        <div className="text-sm font-medium">{contextTokens.toLocaleString()}</div>
        
        <div className="text-sm">Input:</div>
        <div className="text-sm font-medium">{inputTokens.toLocaleString()}</div>
        
        <div className="text-sm">Output:</div>
        <div className="text-sm font-medium">{outputTokens.toLocaleString()}</div>
      </div>
      
      {references.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold mb-1">References Breakdown</h4>
          <ul className="text-sm">
            {references.map(ref => (
              <li key={ref.id} className="flex justify-between">
                <span className="truncate mr-2">{ref.title}</span>
                <span className="font-medium">{ref.tokenCount?.toLocaleString() || "Unknown"} tokens</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TokenUsageDisplay;

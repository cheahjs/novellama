import React from 'react';
import { useTokenizer } from '@/hooks/useTokenizer';

interface LiveTokenCounterProps {
  text: string;
  className?: string;
  debounceMs?: number;
  modelName?: string;
}

const LiveTokenCounter: React.FC<LiveTokenCounterProps> = ({
  text,
  className = '',
  debounceMs = 500,
  modelName,
}) => {
  const { count, isLoading, error } = useTokenizer(text, debounceMs, modelName);

  if (error) {
    return (
      <div className={`text-red-500 ${className}`} title={error}>
        Error
      </div>
    );
  }

  return (
    <div className={`text-sm ${className} text-right`}>
      {isLoading ? (
        <span className="text-gray-400">...</span>
      ) : count !== null ? (
        `${count.toLocaleString()}`
      ) : (
        '0'
      )}
    </div>
  );
};

export default LiveTokenCounter;

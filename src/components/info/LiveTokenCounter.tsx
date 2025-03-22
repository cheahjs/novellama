import React from 'react';
import { useTokenizer } from '@/hooks/useTokenizer';

interface LiveTokenCounterProps {
  text: string;
  className?: string;
  debounceMs?: number;
}

const LiveTokenCounter: React.FC<LiveTokenCounterProps> = ({
  text,
  className = '',
  debounceMs = 500,
}) => {
  const { count, isLoading, error } = useTokenizer(text, debounceMs);

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

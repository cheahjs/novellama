import React from 'react';
import { useTokenizer } from '../hooks/useTokenizer';

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
  modelName
}) => {
  const { count, isLoading, error } = useTokenizer(text, debounceMs, modelName);

  if (error) {
    return <div className={`text-red-500 ${className}`}>Error: {error}</div>;
  }

  if (isLoading) {
    return <div className={`text-gray-500 ${className}`}>Loading...</div>;
  }

  return (
    <div className={`text-sm ${className}`}>
      {count !== null ? `${count.toLocaleString()}` : '...'}
    </div>
  );
};

export default LiveTokenCounter; 
import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ChunkNavigationProps {
  currentIndex: number;
  totalChunks: number;
  onNavigate: (index: number) => void;
}

const ChunkNavigation: React.FC<ChunkNavigationProps> = ({ 
  currentIndex, 
  totalChunks, 
  onNavigate 
}) => {
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < totalChunks - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  // No navigation needed if there are no chunks
  if (totalChunks === 0) return null;

  return (
    <div className="flex items-center justify-between mt-4 mb-2">
      <button
        onClick={goToPrevious}
        disabled={currentIndex <= 0}
        className={`flex items-center px-3 py-1 rounded ${
          currentIndex <= 0
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-blue-600 hover:text-blue-800'
        }`}
      >
        <FiChevronLeft className="mr-1" /> Previous
      </button>
      
      <div className="text-sm text-gray-600">
        {totalChunks > 0 ? `${currentIndex + 1} / ${totalChunks}` : '0 / 0'}
      </div>
      
      <button
        onClick={goToNext}
        disabled={currentIndex >= totalChunks - 1}
        className={`flex items-center px-3 py-1 rounded ${
          currentIndex >= totalChunks - 1
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-blue-600 hover:text-blue-800'
        }`}
      >
        Next <FiChevronRight className="ml-1" />
      </button>
    </div>
  );
};

export default ChunkNavigation;

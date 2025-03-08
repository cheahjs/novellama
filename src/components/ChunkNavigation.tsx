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
    <div className="flex items-center justify-between py-4 px-6 border-t border-b border-gray-200 bg-gray">
      <button
        onClick={goToPrevious}
        disabled={currentIndex <= 0}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
          currentIndex <= 0
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <FiChevronLeft className="w-5 h-5" />
        <span>Previous Chapter</span>
      </button>
      
      <div className="text-sm font-medium text-gray-600">
        Chapter {currentIndex + 1} of {totalChunks}
      </div>
      
      <button
        onClick={goToNext}
        disabled={currentIndex >= totalChunks - 1}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
          currentIndex >= totalChunks - 1
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <span>Next Chapter</span>
        <FiChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChunkNavigation;

import React from 'react';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { TranslationChunk } from '@/types';

interface ChunkNavigationProps {
  currentIndex: number;
  totalChunks: number;
  onNavigate: (index: number, isNewChapter?: boolean) => void;
  chunks: TranslationChunk[];
  currentChapterNumber: number;
}

const ChunkNavigation: React.FC<ChunkNavigationProps> = ({ 
  currentIndex, 
  totalChunks, 
  onNavigate,
  chunks,
  currentChapterNumber
}) => {
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const goToNext = () => {
    // If we're at the last chunk, create a new chapter
    if (currentIndex >= totalChunks - 1) {
      onNavigate(currentChapterNumber + 1, true);
    } else {
      onNavigate(currentIndex + 1);
    }
  };

  const currentChunk = chunks[currentIndex];
  const isNewChapter = currentIndex >= totalChunks;

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
        {isNewChapter ? (
          <>
            <div>New Chapter</div>
            <div className="text-xs text-gray-500 mt-1 text-center">
              Chapter {currentChapterNumber + 1}
            </div>
          </>
        ) : (
          <>
            Chapter {currentIndex + 1} of {totalChunks}
            {currentChunk && (
              <div className="text-xs text-gray-500 mt-1 text-center">
                {currentChunk.title || `Chapter ${currentIndex + 1}`}
              </div>
            )}
          </>
        )}
      </div>
      
      <button
        onClick={goToNext}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 text-gray-700 hover:bg-gray-100"
      >
        <span>{currentIndex >= totalChunks - 1 ? 'New Chapter' : 'Next Chapter'}</span>
        {currentIndex >= totalChunks - 1 ? <FiPlus className="w-5 h-5" /> : <FiChevronRight className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default ChunkNavigation;

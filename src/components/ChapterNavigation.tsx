import React from 'react';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { TranslationChapter } from '@/types';

interface ChapterNavigationProps {
  currentIndex: number;
  totalChapters: number;
  onNavigate: (index: number) => void;
  chapters: TranslationChapter[];
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  currentIndex,
  totalChapters,
  onNavigate,
  chapters,
}) => {
  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    // If we're at the last chapter, create a new chapter
    if (currentIndex >= totalChapters - 1) {
      onNavigate(totalChapters);
    } else {
      onNavigate(currentIndex + 1);
    }
  };

  const currentChapter = chapters[currentIndex];

  return (
    <div className="flex items-center justify-between py-4">
      <button
        onClick={handlePrevious}
        disabled={currentIndex <= 0}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
          currentIndex <= 0
            ? 'text-gray-700 cursor-not-allowed'
            : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        <FiChevronLeft className="w-5 h-5" />
        <span>Previous Chapter</span>
      </button>

      <div className="text-center">
        <div className="text-sm text-gray-500">
          Chapter {currentIndex + 1} of {totalChapters}
        </div>
        {currentChapter && (
          <div className="text-lg font-medium">
            {currentChapter.title || `Chapter ${currentIndex + 1}`}
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-700"
      >
        <span>{currentIndex >= totalChapters - 1 ? 'New Chapter' : 'Next Chapter'}</span>
        {currentIndex >= totalChapters - 1 ? <FiPlus className="w-5 h-5" /> : <FiChevronRight className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default ChapterNavigation; 
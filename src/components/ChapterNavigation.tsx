import React, { useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiPlus, FiList, FiTrash2 } from 'react-icons/fi';
import { TranslationChapter } from '@/types';

interface ChapterNavigationProps {
  currentIndex: number;
  totalChapters: number;
  onNavigate: (index: number) => void;
  chapters: TranslationChapter[];
  onDeleteLatest?: () => void;
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  currentIndex,
  totalChapters,
  onNavigate,
  chapters,
  onDeleteLatest,
}) => {
  const [showTOC, setShowTOC] = useState(false);

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
    <div className="flex items-center justify-between py-4 relative">
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

      <div className="text-center flex-1 mx-4">
        <div className="flex justify-center items-center">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="group inline-flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700"
          >
            <FiList className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
            <div className="text-sm text-gray-500">
              Chapter {currentIndex + 1} of {totalChapters}
            </div>
          </button>
        </div>
        {currentChapter && (
          <div className="text-lg font-medium mt-1">
            {currentChapter.title || `Chapter ${currentIndex + 1}`}
          </div>
        )}
        
        {showTOC && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
            <div className="py-2 max-h-96 overflow-y-auto">
              {chapters.map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onNavigate(index);
                    setShowTOC(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-700 ${
                    index === currentIndex ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="text-sm text-gray-400">Chapter {index + 1}</div>
                  <div className="text-gray-200">
                    {chapter.title || `Chapter ${index + 1}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onDeleteLatest && currentIndex === totalChapters - 1 && totalChapters > 0 && (
          <button
            onClick={onDeleteLatest}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-900/50"
            title="Delete latest chapter"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleNext}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-700"
        >
          <span>{currentIndex >= totalChapters - 1 ? 'New Chapter' : 'Next Chapter'}</span>
          {currentIndex >= totalChapters - 1 ? <FiPlus className="w-5 h-5" /> : <FiChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default ChapterNavigation;
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiList,
  FiTrash2,
  FiMoreVertical,
} from 'react-icons/fi';
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
  const [showActions, setShowActions] = useState(false);
  const isNavigatingRef = useRef(false);

  const safeNavigate = useCallback(
    (targetIndex: number) => {
      if (isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;
      onNavigate(targetIndex);
    },
    [onNavigate],
  );

  useEffect(() => {
    isNavigatingRef.current = false;
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      safeNavigate(currentIndex - 1);
    }
  }, [currentIndex, safeNavigate]);

  const handleNext = useCallback(() => {
    // If we're at the last chapter, create a new chapter
    if (currentIndex >= totalChapters - 1) {
      safeNavigate(totalChapters);
    } else {
      safeNavigate(currentIndex + 1);
    }
  }, [currentIndex, totalChapters, safeNavigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys if no modifiers are pressed
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      // Ignore key events when focus is in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePrevious, handleNext]);

  const currentChapter = chapters[currentIndex];

  return (
    <div className="relative flex items-stretch py-4">
      <button
        onClick={handlePrevious}
        disabled={currentIndex <= 0}
        className={`flex items-center space-x-2 rounded-lg px-4 ${
          currentIndex <= 0
            ? 'cursor-not-allowed text-gray-700'
            : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        <FiChevronLeft className="h-5 w-5" />
        <span>Previous Chapter</span>
      </button>

      <div className="mx-4 flex-1">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="group inline-flex items-center space-x-2 rounded px-2 py-1 hover:bg-gray-700"
          >
            <FiList className="h-4 w-4 text-gray-400 group-hover:text-gray-300" />
            <div className="text-sm text-gray-500">
              Chapter {currentIndex + 1} of {totalChapters}
            </div>
          </button>

          {currentIndex === totalChapters - 1 &&
            totalChapters > 0 &&
            onDeleteLatest && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="rounded p-1 hover:bg-gray-700"
                >
                  <FiMoreVertical className="h-4 w-4 text-gray-400" />
                </button>

                {showActions && (
                  <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                    <button
                      onClick={() => {
                        onDeleteLatest();
                        setShowActions(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-400 hover:bg-gray-700"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Delete Latest Chapter
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
        {currentChapter && (
          <div className="mt-1 text-center text-lg font-medium">
            {currentChapter.title || `Chapter ${currentIndex + 1}`}
          </div>
        )}

        {showTOC && (
          <div className="absolute top-full left-1/2 z-10 mt-2 w-64 -translate-x-1/2 transform rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
            <div className="max-h-96 overflow-y-auto py-2">
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
                  <div className="text-sm text-gray-400">
                    Chapter {index + 1}
                  </div>
                  <div className="text-gray-200">
                    {chapter.title || `Chapter ${index + 1}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        className="flex items-center space-x-2 rounded-lg px-4 text-gray-400 hover:bg-gray-700"
      >
        <span>
          {currentIndex >= totalChapters - 1 ? 'New Chapter' : 'Next Chapter'}
        </span>
        {currentIndex >= totalChapters - 1 ? (
          <FiPlus className="h-5 w-5" />
        ) : (
          <FiChevronRight className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default ChapterNavigation;

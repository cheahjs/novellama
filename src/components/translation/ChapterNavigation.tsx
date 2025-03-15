import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiList,
  FiTrash2,
  FiMoreVertical,
} from 'react-icons/fi';

interface ChapterNavigationProps {
  currentChapter: number;
  totalChapters: number;
  onNavigate: (chapterNumber: number) => void;
  chapters: Array<{ number: number; title: string }>;
  onDeleteLatest?: () => void;
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  currentChapter,
  totalChapters,
  onNavigate,
  chapters,
  onDeleteLatest,
}) => {
  const [showTOC, setShowTOC] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isNavigatingRef = useRef(false);

  const safeNavigate = useCallback(
    (targetChapter: number) => {
      if (isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;
      onNavigate(targetChapter);
    },
    [onNavigate],
  );

  useEffect(() => {
    isNavigatingRef.current = false;
  }, [currentChapter]);

  const handlePrevious = useCallback(() => {
    if (currentChapter > 1) {
      safeNavigate(currentChapter - 1);
    }
  }, [currentChapter, safeNavigate]);

  const handleNext = useCallback(() => {
    // If we're at the last chapter and not already on a new chapter, create a new chapter
    if (currentChapter === totalChapters) {
      safeNavigate(totalChapters + 1);
    } else if (currentChapter < totalChapters) {
      safeNavigate(currentChapter + 1);
    }
  }, [currentChapter, totalChapters, safeNavigate]);

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
      } else if (event.key === 'ArrowRight' && currentChapter <= totalChapters) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePrevious, handleNext, currentChapter, totalChapters]);

  const currentChapterData = chapters.find(ch => ch.number === currentChapter);

  return (
    <div className="relative flex items-stretch py-4">
      <button
        onClick={handlePrevious}
        disabled={currentChapter <= 1}
        className={`flex items-center space-x-2 rounded-lg px-4 ${
          currentChapter <= 1
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
              Chapter {currentChapter} of {totalChapters}
            </div>
          </button>

          {currentChapter === totalChapters &&
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
        {currentChapterData && (
          <div className="mt-1 text-center text-lg font-medium">
            {currentChapterData.title || `Chapter ${currentChapter}`}
          </div>
        )}

        {showTOC && (
          <div className="absolute top-full left-1/2 z-10 mt-2 w-64 -translate-x-1/2 transform rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
            <div className="max-h-96 overflow-y-auto py-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.number}
                  onClick={() => {
                    onNavigate(chapter.number);
                    setShowTOC(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-700 ${
                    chapter.number === currentChapter ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="text-sm text-gray-400">
                    Chapter {chapter.number}
                  </div>
                  <div className="text-gray-200">
                    {chapter.title || `Chapter ${chapter.number}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        className={`flex items-center space-x-2 rounded-lg px-4 ${
          currentChapter > totalChapters
            ? 'cursor-not-allowed text-gray-700'
            : 'text-gray-400 hover:bg-gray-700'
        }`}
        disabled={currentChapter > totalChapters}
      >
        <span>
          {currentChapter === totalChapters ? 'New Chapter' : 'Next Chapter'}
        </span>
        {currentChapter === totalChapters ? (
          <FiPlus className="h-5 w-5" />
        ) : (
          <FiChevronRight className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default ChapterNavigation;

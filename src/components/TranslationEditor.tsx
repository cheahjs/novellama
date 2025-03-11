import React, { useState, useEffect, useRef } from 'react';
import {
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiDownload,
  FiEdit,
  FiSave,
  FiPlayCircle,
} from 'react-icons/fi';
import { TranslationChapter, Novel, TranslationResponse } from '@/types';
import LiveTokenCounter from './LiveTokenCounter';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import TokenUsage from './TokenUsage';
import QualityIndicator from './QualityIndicator';

interface TranslationEditorProps {
  novel: Novel;
  currentChapter: TranslationChapter | null;
  currentChapterNumber: number;
  onTranslate: (
    sourceContent: string,
    previousTranslationData?: {
      previousTranslation: string;
      qualityFeedback: string;
    },
  ) => Promise<TranslationResponse | undefined>;
  onSaveEdit?: (title: string, translatedContent: string) => Promise<void>;
  isLoading: boolean;
  onBatchTranslate?: (count: number) => Promise<void>;
  isBatchTranslating?: boolean;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  novel,
  currentChapter,
  currentChapterNumber,
  onTranslate,
  onSaveEdit,
  isLoading,
  onBatchTranslate,
  isBatchTranslating,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sourceContent, setSourceContent] = useState<string>('');
  const [showSource, setShowSource] = useState<boolean>(false);
  const [isScrapingChapter, setIsScrapingChapter] = useState<boolean>(false);
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);
  const [lastTokenUsage, setLastTokenUsage] =
    useState<TranslationResponse['tokenUsage']>();
  const [lastQualityCheck, setLastQualityCheck] =
    useState<TranslationResponse['qualityCheck']>();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(5);

  useEffect(() => {
    if (currentChapter) {
      if (isRetranslating) {
        setSourceContent(currentChapter.sourceContent);
      } else {
        setSourceContent('');
      }
      setEditTitle(currentChapter.title);
      setEditContent(currentChapter.translatedContent);

      // Set the quality check from the current chapter if available
      if (currentChapter.qualityCheck) {
        setLastQualityCheck(currentChapter.qualityCheck);
      } else {
        setLastQualityCheck(undefined);
      }
    }
  }, [currentChapter, isRetranslating]);

  const handleScrapeChapter = async () => {
    if (!novel?.sourceUrl) return;

    try {
      setIsScrapingChapter(true);
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: novel.sourceUrl,
          chapterNumber: currentChapterNumber,
          type: 'syosetu',
        }),
      });

      if (!response.ok) throw new Error('Failed to scrape chapter');

      const data = await response.json();
      if (data.title && data.content) {
        setSourceContent(`# ${data.title}\n\n${data.content}`);
      }
    } catch (error) {
      console.error('Error scraping chapter:', error);
    } finally {
      setIsScrapingChapter(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceContent.trim() && !isScrapingChapter && !isLoading) {
      // If retranslating with a quality check, pass the previous translation and feedback
      const previousTranslationData =
        isRetranslating && currentChapter?.qualityCheck
          ? {
              previousTranslation: currentChapter.translatedContent,
              qualityFeedback: currentChapter.qualityCheck.feedback,
            }
          : undefined;

      const result = await onTranslate(sourceContent, previousTranslationData);
      if (result) {
        setLastTokenUsage(result.tokenUsage);
        setLastQualityCheck(result.qualityCheck);
        setShowSource(false); // Switch to showing translated content
      }
      setSourceContent('');
      setIsRetranslating(false);
    }
  };

  const handleRetranslate = () => {
    if (currentChapter) {
      setSourceContent(currentChapter.sourceContent);
      setIsRetranslating(true);
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const canScrapeChapter = novel?.sourceUrl;

  return (
    <div className="mt-6 space-y-4">
      {currentChapter ? (
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              {/* Only show quality indicator if we have a current chapter with quality data */}
              {currentChapter.qualityCheck && (
                <QualityIndicator qualityCheck={currentChapter.qualityCheck} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isEditing && onSaveEdit) {
                    onSaveEdit(editTitle, editContent).then(() =>
                      setIsEditing(false),
                    );
                  } else {
                    setIsEditing(!isEditing);
                  }
                }}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                {!showSource &&
                  (isEditing ? (
                    <>
                      <FiSave className="mr-1" /> Save changes
                    </>
                  ) : (
                    <>
                      <FiEdit className="mr-1" /> Edit translation
                    </>
                  ))}
              </button>
              <button
                type="button"
                onClick={() => setShowSource(!showSource)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                {showSource ? (
                  <>
                    <FiEyeOff className="mr-1" /> Hide source
                  </>
                ) : (
                  <>
                    <FiEye className="mr-1" /> Show source
                  </>
                )}
              </button>
            </div>
          </div>

          {showSource && (
            <div className="relative mb-4">
              <div className="rounded bg-gray-900 p-3 text-sm whitespace-pre-wrap text-gray-100">
                {currentChapter.sourceContent}
              </div>
              <button
                type="button"
                onClick={handleRetranslate}
                className="absolute top-2 right-2 flex items-center rounded bg-gray-700 p-1.5 text-sm text-white hover:bg-gray-600"
                title="Retranslate this text"
              >
                <FiRefreshCw className="mr-1" /> Retranslate
              </button>
            </div>
          )}

          {!showSource && !isEditing && (
            <div className="prose prose-invert translation-content max-w-none">
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                {currentChapter.translatedContent}
              </ReactMarkdown>
            </div>
          )}
          {!showSource && isEditing && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-200">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded border bg-gray-800 p-2 text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-200">
                  Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="h-96 w-full rounded border bg-gray-800 p-2 font-mono text-white focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">
          {isScrapingChapter
            ? 'Scraping chapter content...'
            : 'Start translating by entering content below'}
        </div>
      )}

      {(!currentChapter || isRetranslating) && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              placeholder={
                isScrapingChapter
                  ? 'Loading chapter content...'
                  : isLoading
                    ? 'Translating...'
                    : 'Enter text to translate...'
              }
              className="h-40 w-full rounded-lg border p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isScrapingChapter || isLoading}
            />
            <div className="absolute top-2 right-2">
              <LiveTokenCounter
                text={sourceContent}
                className="rounded bg-gray-800 px-2 py-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleScrapeChapter}
              disabled={!canScrapeChapter || isScrapingChapter || isLoading}
              className={`flex flex-1 items-center justify-center rounded-md px-4 py-2 ${
                !canScrapeChapter || isScrapingChapter || isLoading
                  ? 'cursor-not-allowed bg-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <FiDownload className="mr-2" />
              {isScrapingChapter ? 'Loading Chapter...' : 'Load Chapter'}
            </button>

            <button
              type="submit"
              disabled={isScrapingChapter || isLoading || !sourceContent.trim()}
              className={`flex-1 rounded-md px-4 py-2 ${
                isScrapingChapter || isLoading || !sourceContent.trim()
                  ? 'cursor-not-allowed bg-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Translating...' : 'Translate'}
            </button>

            {onBatchTranslate && (
              <div className="ml-2 flex items-center gap-2">
                <input
                  type="number"
                  value={batchCount}
                  onChange={(e) =>
                    setBatchCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-16 rounded-md bg-gray-700 px-2 py-2 text-white"
                  min="1"
                />
                <button
                  type="button"
                  onClick={() => onBatchTranslate(batchCount)}
                  disabled={isBatchTranslating || isLoading}
                  className={`flex items-center rounded-md px-4 py-2 ${
                    isBatchTranslating || isLoading
                      ? 'cursor-not-allowed bg-gray-500'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  <FiPlayCircle className="mr-2" />
                  {isBatchTranslating ? 'Processing...' : 'Batch Translate'}
                </button>
              </div>
            )}
          </div>

          {lastTokenUsage && (
            <TokenUsage
              tokenUsage={lastTokenUsage}
              className="mt-4 rounded-lg border p-3"
            />
          )}

          {/* Only show quality indicator after translation */}
          {lastQualityCheck && isRetranslating && (
            <QualityIndicator
              qualityCheck={lastQualityCheck}
              className="mt-4 rounded-lg border p-3"
            />
          )}
        </form>
      )}
    </div>
  );
};

export default TranslationEditor;

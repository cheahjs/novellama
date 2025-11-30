import React, { useState, useEffect, useRef } from 'react';
import {
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiDownload,
  FiEdit,
  FiSave,
  FiPlayCircle,
  FiCloudLightning,
  FiList,
  FiClock,
  FiCopy,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { QualityCheckResponse, TranslationChapter, TranslationResponse, AppearanceSettings, ChapterRevision } from '@/types';
import LiveTokenCounter from '@/components/info/LiveTokenCounter';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import TokenUsage from '@/components/info/TokenUsage';
import QualityIndicator from '@/components/info/QualityIndicator';
import { toast } from 'react-hot-toast';

interface TranslationEditorProps {
  novelId: string;
  chapter: TranslationChapter | null;
  onTranslate: (
    sourceContent: string,
    useAutoRetry: boolean,
    maxAttempts: number,
    previousTranslationData?: {
      previousTranslation?: string;
      qualityFeedback?: string;
      useImprovementFeedback?: boolean;
    },
    onUpdate?: (partial: string) => void,
  ) => Promise<TranslationResponse | undefined>;
  onSaveEdit?: (title: string, translatedContent: string) => Promise<void>;
  onQualityCheck?: (sourceContent: string, translatedContent: string) => Promise<QualityCheckResponse | undefined>;
  isTranslating: boolean;
  onBatchTranslate?: (
    count: number,
    useAutoRetry: boolean,
    maxAttempts: number,
  ) => Promise<void>;
  onBatchRetranslate?: (
    startChapter: number,
    endChapter: number,
    useAutoRetry: boolean,
    maxAttempts: number,
  ) => Promise<void>;
  isBatchTranslating?: boolean;
  onCancelBatchTranslate?: () => void;
  novelSourceUrl?: string;
  nextChapterNumber?: number;
  totalChapters?: number;
  appearanceSettings?: AppearanceSettings;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  novelId,
  chapter,
  onTranslate,
  onSaveEdit,
  onQualityCheck,
  isTranslating,
  onBatchTranslate,
  onBatchRetranslate,
  isBatchTranslating,
  onCancelBatchTranslate,
  novelSourceUrl,
  nextChapterNumber,
  totalChapters,
  appearanceSettings,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sourceContent, setSourceContent] = useState<string>('');
  const [showSource, setShowSource] = useState<boolean>(false);
  const [isScrapingChapter, setIsScrapingChapter] = useState<boolean>(false);
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);
  const [isCheckingQuality, setIsCheckingQuality] = useState<boolean>(false);
  const [lastTokenUsage, setLastTokenUsage] =
    useState<TranslationResponse['tokenUsage']>();
  const [lastQualityCheck, setLastQualityCheck] =
    useState<TranslationResponse['qualityCheck']>();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(5);
  const [useImprovementFeedback, setUseImprovementFeedback] =
    useState<boolean>(true);
  const [useAutoRetry, setUseAutoRetry] = useState<boolean>(false);
  const [maxAttempts, setMaxAttempts] = useState<number>(5);
  const [isAutoRetrying, setIsAutoRetrying] = useState<boolean>(false);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState<number>(0);
  const [useExistingTranslation, setUseExistingTranslation] =
    useState<boolean>(true);
  const [displayedChapter, setDisplayedChapter] = useState(chapter);
  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(1);
  const [showBatchRetranslate, setShowBatchRetranslate] =
    useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState<boolean>(false);
  const [revisions, setRevisions] = useState<ChapterRevision[]>([]);
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null);

  const loadRevisions = async (novelIdParam: string, chapterNumber: number) => {
    try {
      setIsLoadingRevisions(true);
      const { getChapterRevisions } = await import('@/services/storage');
      const data = await getChapterRevisions(novelIdParam, chapterNumber);
      setRevisions(data);
    } catch (error) {
      console.error('Failed to load revisions:', error);
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  const [streamingContent, setStreamingContent] = useState<string>('');

  // Auto-scroll to bottom when streaming content updates
  useEffect(() => {
    if (streamingContent && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [streamingContent]);

  useEffect(() => {
    // Reset states when chapter changes or when moving to a new chapter
    setIsRetranslating(false);
    setIsAutoRetrying(false);
    setAutoRetryAttempt(0);
    setShowSource(false);
    setIsEditing(false);
    setSourceContent('');
    setStreamingContent('');

    if (chapter) {
      // Update content states
      setEditTitle(chapter.title);
      setEditContent(chapter.translatedContent);

      // Update displayed chapter immediately when chapter prop changes
      setDisplayedChapter(chapter);

      // Set the quality check from the current chapter if available
      setLastQualityCheck(chapter.qualityCheck ?? undefined);
      if (showHistory) {
        loadRevisions(novelId, chapter.number);
      } else {
        setRevisions([]);
      }
    } else {
      // Only clear displayed chapter if we're explicitly moving to a new chapter
      // (i.e., when nextChapterNumber is provided)
      if (nextChapterNumber && !chapter) {
        setDisplayedChapter(null);
        setEditTitle('');
        setEditContent('');
        setLastQualityCheck(undefined);
      }
    }
  }, [chapter, nextChapterNumber, novelId, showHistory]);

  useEffect(() => {
    if (showHistory && displayedChapter) {
      loadRevisions(novelId, displayedChapter.number);
    }
  }, [showHistory, displayedChapter, novelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceContent.trim() && !isScrapingChapter && !isTranslating) {
      try {
        setStreamingContent('');
        // For retranslation, pass previous translation data if enabled
        const previousTranslationData =
          isRetranslating &&
          displayedChapter?.qualityCheck &&
          useExistingTranslation
            ? {
                previousTranslation: displayedChapter.translatedContent,
                qualityFeedback: displayedChapter.qualityCheck.feedback,
                useImprovementFeedback,
              }
            : undefined;

        const result = await onTranslate(
          sourceContent,
          useAutoRetry,
          maxAttempts,
          previousTranslationData,
          (partial) => setStreamingContent(partial),
        );

        if (result) {
          setLastTokenUsage(result.tokenUsage);
          setLastQualityCheck(result.qualityCheck);
          setShowSource(false);
        }
      } finally {
        setSourceContent('');
        setIsRetranslating(false);
        setIsAutoRetrying(false);
        setAutoRetryAttempt(0);
        setStreamingContent('');
      }
    }
  };

  const handleRetranslate = () => {
    if (!displayedChapter) return;
    setSourceContent(displayedChapter.sourceContent);
    setIsRetranslating(true);
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleScrapeChapter = async () => {
    if (!novelSourceUrl || isScrapingChapter || !nextChapterNumber) return;

    setIsScrapingChapter(true);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: novelSourceUrl,
          chapterNumber: chapter?.number ?? nextChapterNumber,
          type: 'syosetu',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape chapter');
      }

      const data = await response.json();
      if (!data.title || !data.content) {
        throw new Error('No content found');
      }

      setSourceContent(`# ${data.title}\n\n${data.content}`);
      toast.success('Content scraped successfully');
    } catch (error) {
      console.error('Failed to scrape chapter:', error);
      toast.error('Failed to scrape chapter');
    } finally {
      setIsScrapingChapter(false);
    }
  };

  const handleQualityCheck = async () => {
    if (!displayedChapter || !onQualityCheck || isCheckingQuality) return;
    
    setIsCheckingQuality(true);
    try {
      const result = await onQualityCheck(
        displayedChapter.sourceContent,
        isEditing ? editContent : displayedChapter.translatedContent
      );
      if (result) {
        setLastQualityCheck(result);
        toast.success(`Quality check of ${displayedChapter.number} completed`);
      }
    } catch (error) {
      console.error('Quality check error:', error);
      toast.error(`Failed to check quality of ${displayedChapter.number}`);
    } finally {
      setIsCheckingQuality(false);
    }
  };

  // Define default styles or use provided settings
  const editorStyle: React.CSSProperties = {
    fontSize: `${appearanceSettings?.fontSize || 16}px`,
    fontFamily: appearanceSettings?.fontFamily || 'sans-serif',
  };

  const marginClass = `p-${appearanceSettings?.margin || 4}`;

  return (
    <div className="mt-6 space-y-4">
      {displayedChapter && !isRetranslating ? (
        <div className={`rounded-lg border ${marginClass}`} style={{ borderColor: '#374151' /* gray-700 */ }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              {/* Only show quality indicator if we have a current chapter with quality data */}
              {displayedChapter?.qualityCheck && (
                <QualityIndicator
                  qualityCheck={displayedChapter.qualityCheck}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {displayedChapter && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  {showHistory ? (
                    <>
                      <FiX className="mr-1" /> Hide history
                    </>
                  ) : (
                    <>
                      <FiList className="mr-1" /> History
                    </>
                  )}
                </button>
              )}
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
              {onQualityCheck && !showSource && (
                <button
                  type="button"
                  onClick={handleQualityCheck}
                  disabled={isCheckingQuality}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  <FiRefreshCw className={`mr-1 ${isCheckingQuality ? 'animate-spin' : ''}`} />
                  {isCheckingQuality ? 'Checking...' : 'Check Quality'}
                </button>
              )}
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

          {showHistory && displayedChapter && (
            <div className="mb-4 rounded-lg border border-gray-700 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  Revision history for chapter {displayedChapter.number}
                </div>
                <div className="text-xs text-gray-400">
                  {isLoadingRevisions
                    ? 'Loading...'
                    : `${revisions.length} revision${revisions.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <div className="space-y-2">
                {revisions.length === 0 && !isLoadingRevisions && (
                  <div className="text-sm text-gray-500">No revisions yet.</div>
                )}
                {revisions.map((rev) => (
                  <div key={rev.id} className="rounded border border-gray-700 p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <FiClock className="text-gray-500" />
                        <span>{new Date(rev.createdAt).toLocaleString()}</span>
                        {rev.qualityCheck && (
                          <span className="ml-2 text-xs text-gray-400">Score: {rev.qualityCheck.score}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(rev.translatedContent);
                              toast.success('Copied revision markdown');
                            } catch (error) {
                              console.error('Failed to copy revision:', error);
                              toast.error('Failed to copy');
                            }
                          }}
                          className="flex items-center text-xs text-gray-400 hover:text-gray-200"
                        >
                          <FiCopy className="mr-1" /> Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedRevisionId(expandedRevisionId === rev.id ? null : rev.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {expandedRevisionId === rev.id ? 'Hide' : 'View'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Delete this revision? This cannot be undone.')) return;
                            try {
                              const { deleteChapterRevision } = await import('@/services/storage');
                              await deleteChapterRevision(novelId, displayedChapter.number, rev.id);
                              setRevisions((prev) => prev.filter((r) => r.id !== rev.id));
                              if (expandedRevisionId === rev.id) setExpandedRevisionId(null);
                            } catch (error) {
                              console.error('Failed to delete revision:', error);
                            }
                          }}
                          className="flex items-center text-xs text-red-400 hover:text-red-300"
                        >
                          <FiTrash2 className="mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                    {expandedRevisionId === rev.id && (
                      <div className="mt-2 space-y-2">
                        <div className="text-sm font-medium text-gray-200">{rev.title}</div>
                        <div className="prose prose-invert max-w-none text-sm">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                            {rev.translatedContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSource && displayedChapter && (
            <div className="relative mb-4">
              <div className="prose prose-invert translation-content max-w-none">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {displayedChapter.sourceContent}
                </ReactMarkdown>
              </div>
              <button
                type="button"
                onClick={handleRetranslate}
                className="absolute top-2 right-2 flex items-center rounded bg-gray-700 p-1.5 text-sm text-white hover:bg-gray-600"
                title="Retranslate this text"
                disabled={isTranslating}
              >
                <FiRefreshCw className="mr-1" />{' '}
                {isTranslating ? 'Translating...' : 'Retranslate'}
              </button>
            </div>
          )}

          {!showSource && !isEditing && displayedChapter && (
            <div className="prose prose-invert max-w-none translation-content" style={{ fontSize: editorStyle.fontSize, fontFamily: editorStyle.fontFamily, wordBreak: 'break-word' }}>
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                {displayedChapter.translatedContent}
              </ReactMarkdown>
            </div>
          )}
          {!showSource && isEditing && (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded border bg-gray-800 px-3 py-2 text-lg font-medium text-gray-100"
                placeholder="Chapter title"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-96 w-full rounded border bg-gray-800 px-3 py-2 text-gray-100"
                placeholder="Chapter content"
              />
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={streamingContent || sourceContent}
              onChange={(e) => !isTranslating && setSourceContent(e.target.value)}
              placeholder={
                isTranslating ? 'Translating...' : 'Enter text to translate...'
              }
              className="h-40 w-full rounded-lg border p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isTranslating && !streamingContent}
              readOnly={isTranslating}
            />
            <div className="absolute top-2 right-2">
              <LiveTokenCounter
                text={sourceContent}
                className="rounded bg-gray-800 px-2 py-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            {novelSourceUrl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScrapeChapter}
                  disabled={isScrapingChapter}
                  className="flex items-center rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isScrapingChapter ? (
                    <>
                      <FiRefreshCw className="mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <FiCloudLightning className="mr-2" />
                      Scrape Content
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useAutoRetry"
                checked={useAutoRetry}
                onChange={(e) => setUseAutoRetry(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useAutoRetry" className="text-sm text-gray-300">
                Auto-retry translation until good quality
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-20 rounded border bg-gray-800 px-2 py-1 text-sm text-gray-100"
                aria-label="Max attempts"
                title="Max retry attempts"
              />
              <span className="text-xs text-gray-400">attempts</span>
            </div>

            {isRetranslating && displayedChapter?.qualityCheck && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useExistingTranslation"
                    checked={useExistingTranslation}
                    onChange={(e) =>
                      setUseExistingTranslation(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="useExistingTranslation"
                    className="text-sm text-gray-300"
                  >
                    Use existing translation for first attempt
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useImprovementFeedback"
                    checked={useImprovementFeedback}
                    onChange={(e) =>
                      setUseImprovementFeedback(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="useImprovementFeedback"
                    className="text-sm text-gray-300"
                  >
                    Use feedback for improvement in retries
                  </label>
                </div>
              </>
            )}
          </div>

          {isAutoRetrying && (
            <div className="mt-2 text-sm text-gray-400">
              Attempt {autoRetryAttempt}/{maxAttempts} - Trying to achieve good quality
              translation...
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!sourceContent.trim() || isTranslating}
                className="flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <FiRefreshCw className="mr-2 animate-spin" />
                    {isAutoRetrying
                      ? `Attempt ${autoRetryAttempt}/${maxAttempts}...`
                      : 'Translating...'}
                  </>
                ) : (
                  <>
                    <FiDownload className="mr-2" />
                    Translate
                  </>
                )}
              </button>
              {isRetranslating && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRetranslating(false);
                    setSourceContent('');
                  }}
                  className="flex items-center rounded border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {onBatchTranslate && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={batchCount}
                    onChange={(e) =>
                      setBatchCount(Math.max(1, parseInt(e.target.value)))
                    }
                    className="w-16 rounded border bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => onBatchTranslate(batchCount, useAutoRetry, maxAttempts)}
                    disabled={isBatchTranslating}
                    className="flex items-center rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBatchTranslating ? (
                      <>
                        <FiRefreshCw className="mr-2 animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <FiPlayCircle className="mr-2" />
                        Batch Translate
                      </>
                    )}
                  </button>
                </div>
              )}

              {onBatchRetranslate && totalChapters && totalChapters > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowBatchRetranslate(!showBatchRetranslate)
                    }
                    className="flex items-center rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
                  >
                    <FiRefreshCw className="mr-2" />
                    Bulk Retranslate
                  </button>
                </div>
              )}

              {isBatchTranslating && onCancelBatchTranslate && (
                <button
                  type="button"
                  onClick={onCancelBatchTranslate}
                  className="text-sm text-red-400 hover:text-red-500"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {showBatchRetranslate && onBatchRetranslate && totalChapters && (
            <div className="mt-4 rounded-lg border border-gray-700 p-4">
              <h3 className="mb-3 text-lg font-medium">Bulk Retranslation</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Start Chapter:</label>
                  <input
                    type="number"
                    value={startChapter}
                    onChange={(e) =>
                      setStartChapter(
                        Math.max(
                          1,
                          Math.min(
                            totalChapters,
                            parseInt(e.target.value) || 1,
                          ),
                        ),
                      )
                    }
                    className="w-16 rounded border bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    min="1"
                    max={totalChapters}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">End Chapter:</label>
                  <input
                    type="number"
                    value={endChapter}
                    onChange={(e) =>
                      setEndChapter(
                        Math.max(
                          startChapter,
                          Math.min(
                            totalChapters,
                            parseInt(e.target.value) || 1,
                          ),
                        ),
                      )
                    }
                    className="w-16 rounded border bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    min={startChapter}
                    max={totalChapters}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bulkUseAutoRetry"
                    checked={useAutoRetry}
                    onChange={(e) => setUseAutoRetry(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="bulkUseAutoRetry" className="text-sm">
                    Auto-retry for quality
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-20 rounded border bg-gray-800 px-2 py-1 text-sm text-gray-100"
                    aria-label="Max attempts"
                    title="Max retry attempts"
                  />
                  <span className="text-xs text-gray-400">attempts</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onBatchRetranslate(startChapter, endChapter, useAutoRetry, maxAttempts);
                    setShowBatchRetranslate(false);
                  }}
                  disabled={isBatchTranslating}
                  className="flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBatchTranslating ? (
                    <>
                      <FiRefreshCw className="mr-2 animate-spin" />
                      Retranslating...
                    </>
                  ) : (
                    <>
                      <FiRefreshCw className="mr-2" />
                      Start Retranslation
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {lastTokenUsage && <TokenUsage tokenUsage={lastTokenUsage} />}

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

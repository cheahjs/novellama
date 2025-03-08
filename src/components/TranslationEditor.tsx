import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiRefreshCw, FiDownload } from 'react-icons/fi';
import { TranslationChapter, Novel } from '@/types';
import LiveTokenCounter from './LiveTokenCounter';

interface TranslationEditorProps {
  novel: Novel;
  currentChapter: TranslationChapter | null;
  onTranslate: (sourceContent: string) => Promise<void>;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  novel,
  currentChapter,
  onTranslate,
}) => {
  const [sourceContent, setSourceContent] = useState<string>('');
  const [showSource, setShowSource] = useState<boolean>(false);
  const [isScrapingChapter, setIsScrapingChapter] = useState<boolean>(false);

  useEffect(() => {
    if (currentChapter) {
      setSourceContent(currentChapter.sourceContent);
    }
  }, [currentChapter]);

  const handleScrapeChapter = async () => {
    if (!novel?.sourceUrl) return;
    
    try {
      setIsScrapingChapter(true);
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: novel.sourceUrl,
          chapterNumber: (currentChapter?.number ?? 0) + 1,
          type: 'syosetu'
        })
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
    if (sourceContent.trim() && !isScrapingChapter) {
      await onTranslate(sourceContent);
      setSourceContent('');
    }
  };

  const handleRetranslate = () => {
    if (currentChapter) {
      setSourceContent(currentChapter.sourceContent);
    }
  };

  const canScrapeChapter = novel?.sourceUrl;

  return (
    <div className="mt-6 space-y-4">
      {currentChapter ? (
        <div className="rounded-lg border p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-500">{currentChapter.title}</h3>
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
          
          {showSource && (
            <div className="relative mb-4">
              <div className="p-3 bg-gray-900 rounded text-gray-100 text-sm whitespace-pre-wrap">
                {currentChapter.sourceContent}
              </div>
              <button
                type="button"
                onClick={handleRetranslate}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white flex items-center text-sm"
                title="Retranslate this text"
              >
                <FiRefreshCw className="mr-1" /> Retranslate
              </button>
            </div>
          )}
          
          <div className="w-full h-64 bg-white rounded-lg border border-gray-300 p-4 overflow-y-auto">
            {currentChapter.sourceContent}
          </div>
          
          <div className="w-full h-64 bg-white rounded-lg border border-gray-300 p-4 overflow-y-auto">
            {currentChapter.translatedContent}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isScrapingChapter ? 'Scraping chapter content...' : 'Start translating by entering content below'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            placeholder={isScrapingChapter ? 'Loading chapter content...' : 'Enter text to translate...'}
            className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isScrapingChapter}
          />
          <div className="absolute top-2 right-2">
            <LiveTokenCounter text={sourceContent} className="bg-gray-800 px-2 py-1 rounded" />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleScrapeChapter}
            disabled={!canScrapeChapter || isScrapingChapter}
            className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center ${
              !canScrapeChapter || isScrapingChapter
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <FiDownload className="mr-2" />
            {isScrapingChapter ? 'Loading Chapter...' : 'Load Chapter'}
          </button>

          <button
            type="submit"
            disabled={isScrapingChapter || !sourceContent.trim()}
            className={`flex-1 py-2 px-4 rounded-md ${
              isScrapingChapter || !sourceContent.trim()
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isScrapingChapter ? 'Translating...' : 'Translate'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TranslationEditor;

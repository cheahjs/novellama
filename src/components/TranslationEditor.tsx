import React, { useState, useEffect, useRef } from "react";
import { FiEye, FiEyeOff, FiRefreshCw, FiDownload, FiEdit, FiSave } from "react-icons/fi";
import { TranslationChapter, Novel, TranslationResponse } from "@/types";
import LiveTokenCounter from "./LiveTokenCounter";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import TokenUsage from "./TokenUsage";

interface TranslationEditorProps {
  novel: Novel;
  currentChapter: TranslationChapter | null;
  currentChapterNumber: number;
  onTranslate: (sourceContent: string) => Promise<TranslationResponse | undefined>;
  onSaveEdit?: (title: string, translatedContent: string) => Promise<void>;
  isLoading: boolean;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  novel,
  currentChapter,
  currentChapterNumber,
  onTranslate,
  onSaveEdit,
  isLoading,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sourceContent, setSourceContent] = useState<string>("");
  const [showSource, setShowSource] = useState<boolean>(false);
  const [isScrapingChapter, setIsScrapingChapter] = useState<boolean>(false);
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);
  const [lastTokenUsage, setLastTokenUsage] = useState<TranslationResponse['tokenUsage']>();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");

  useEffect(() => {
    if (currentChapter) {
      if (isRetranslating) {
        setSourceContent(currentChapter.sourceContent);
      } else {
        setSourceContent("");
      }
      setEditTitle(currentChapter.title);
      setEditContent(currentChapter.translatedContent);
    }
  }, [currentChapter, isRetranslating]);

  const handleScrapeChapter = async () => {
    if (!novel?.sourceUrl) return;

    try {
      setIsScrapingChapter(true);
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: novel.sourceUrl,
          chapterNumber: currentChapterNumber + 1,
          type: "syosetu",
        }),
      });

      if (!response.ok) throw new Error("Failed to scrape chapter");

      const data = await response.json();
      if (data.title && data.content) {
        setSourceContent(`# ${data.title}\n\n${data.content}`);
      }
    } catch (error) {
      console.error("Error scraping chapter:", error);
    } finally {
      setIsScrapingChapter(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceContent.trim() && !isScrapingChapter && !isLoading) {
      const result = await onTranslate(sourceContent);
      if (result) {
        setLastTokenUsage(result.tokenUsage);
      }
      setSourceContent("");
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
          <div className="flex justify-end items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                if (isEditing && onSaveEdit) {
                  onSaveEdit(editTitle, editContent)
                    .then(() => setIsEditing(false));
                } else {
                  setIsEditing(!isEditing);
                }
              }}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              {isEditing ? (
                <>
                  <FiSave className="mr-1" /> Save changes
                </>
              ) : (
                <>
                  <FiEdit className="mr-1" /> Edit translation
                </>
              )}
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

          {!showSource && !isEditing && (
            <div className="prose prose-invert max-w-none translation-content">
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>{currentChapter.translatedContent}</ReactMarkdown>
            </div>
          )}
          {!showSource && isEditing && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-96 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isScrapingChapter
            ? "Scraping chapter content..."
            : "Start translating by entering content below"}
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
                  ? "Loading chapter content..."
                  : isLoading
                    ? "Translating..."
                    : "Enter text to translate..."
              }
              className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isScrapingChapter || isLoading}
            />
            <div className="absolute top-2 right-2">
              <LiveTokenCounter
                text={sourceContent}
                className="bg-gray-800 px-2 py-1 rounded"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleScrapeChapter}
              disabled={!canScrapeChapter || isScrapingChapter || isLoading}
              className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center ${!canScrapeChapter || isScrapingChapter || isLoading
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
                }`}
            >
              <FiDownload className="mr-2" />
              {isScrapingChapter ? "Loading Chapter..." : "Load Chapter"}
            </button>

            <button
              type="submit"
              disabled={isScrapingChapter || isLoading || !sourceContent.trim()}
              className={`flex-1 py-2 px-4 rounded-md ${isScrapingChapter || isLoading || !sourceContent.trim()
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
            >
              {isLoading ? "Translating..." : "Translate"}
            </button>
          </div>

          {lastTokenUsage && (
            <TokenUsage tokenUsage={lastTokenUsage} className="mt-4 p-3 border rounded-lg" />
          )}
        </form>
      )}
    </div>
  );
};

export default TranslationEditor;

import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { TranslationChunk } from '@/types';

interface TranslationEditorProps {
  onSubmit: (sourceContent: string) => Promise<void>;
  currentChunk: TranslationChunk | null;
  isLoading: boolean;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({ 
  onSubmit, 
  currentChunk,
  isLoading 
}) => {
  const [sourceContent, setSourceContent] = useState<string>('');
  const [showSource, setShowSource] = useState<boolean>(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceContent.trim() && !isLoading) {
      await onSubmit(sourceContent);
      setSourceContent('');
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {currentChunk ? (
        <div className="rounded-lg border p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Translation</h3>
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
            <div className="mb-4 p-3 bg-gray-50 rounded text-gray-700 text-sm whitespace-pre-wrap">
              {currentChunk.sourceContent}
            </div>
          )}
          
          <div className="whitespace-pre-wrap">
            {currentChunk.translatedContent}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Start translating by entering content below
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={sourceContent}
          onChange={(e) => setSourceContent(e.target.value)}
          placeholder="Enter text to translate..."
          className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !sourceContent.trim()}
          className={`w-full py-2 px-4 rounded-md ${
            isLoading || !sourceContent.trim()
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? 'Translating...' : 'Translate'}
        </button>
      </form>
    </div>
  );
};

export default TranslationEditor;

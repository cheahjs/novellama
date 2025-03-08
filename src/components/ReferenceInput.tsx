import React, { useState } from 'react';
import { Reference } from '@/types';
import axios from 'axios';
import toast from 'react-hot-toast';
import LiveTokenCounter from './LiveTokenCounter';

interface ReferenceInputProps {
  onAdd: (reference: Omit<Reference, 'id'>) => void;
  initialReference?: Reference;
}

const ReferenceInput: React.FC<ReferenceInputProps> = ({ onAdd, initialReference }) => {
  const [inputType, setInputType] = useState<'text' | 'url'>(initialReference ? 'text' : 'text');
  const [title, setTitle] = useState(initialReference?.title || '');
  const [content, setContent] = useState(initialReference?.content || '');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (inputType === 'text') {
      if (!title.trim() || !content.trim()) {
        toast.error('Please fill in both title and content');
        return;
      }
      onAdd({ title, content });
      setTitle('');
      setContent('');
    } else {
      if (!url.trim()) {
        toast.error('Please enter a URL');
        return;
      }

      setIsLoading(true);
      try {
        const response = await axios.post('/api/scrape', { url });
        const { title: scrapedTitle, content: scrapedContent } = response.data;
        onAdd({
          title: scrapedTitle || url,
          content: scrapedContent,
        });
        setUrl('');
      } catch (error) {
        toast.error('Failed to scrape the webpage. Please try again or use text input.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-4 mb-4">
        <button
          type="button"
          onClick={() => setInputType('text')}
          className={`px-4 py-2 rounded ${
            inputType === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => setInputType('url')}
          className={`px-4 py-2 rounded ${
            inputType === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          URL
        </button>
      </div>

      {inputType === 'text' ? (
        <>
          <div>
            <input
              type="text"
              placeholder="Reference Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="relative">
            <textarea
              placeholder="Reference Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded"
            />
            <div className="absolute top-2 right-2">
              <LiveTokenCounter text={content} className="bg-gray-800 px-2 py-1 rounded" />
            </div>
          </div>
        </>
      ) : (
        <div>
          <input
            type="url"
            placeholder="Enter webpage URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded text-white ${
          isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading ? 'Loading...' : 'Add Reference'}
      </button>
    </div>
  );
};

export default ReferenceInput; 
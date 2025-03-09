import React, { useState } from 'react';
import Link from 'next/link';
import { Novel } from '@/types';
import { FiBook, FiEdit, FiTrash, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface NovelListProps {
  novels: Novel[];
  onDelete: (id: string) => void;
}

const NovelList: React.FC<NovelListProps> = ({ novels, onDelete }) => {
  const [expandedNovel, setExpandedNovel] = useState<string | null>(null);

  if (!novels || novels.length === 0) {
    return (
      <div className="text-center py-10">
        <FiBook className="mx-auto text-4xl text-gray-400" />
        <p className="mt-4 text-gray-500">No novels found. Create your first translation project.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {novels.map((novel) => (
        <div key={novel.id} className="border rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-bold text-lg">{novel.title}</h3>
          <div className="text-sm text-gray-500 my-2">
            {novel.sourceLanguage} → {novel.targetLanguage}
          </div>
          <div className="text-sm text-gray-500">
            {novel.chapters?.length || 0} chapters translated
          </div>
          <div className="mt-4 flex justify-between items-center">
            <Link href={`/translate/${novel.id}`} className="text-blue-600 hover:underline flex items-center">
              <FiEdit className="mr-1" /> Continue
            </Link>
            <div className="flex gap-2">
              <button 
                onClick={() => setExpandedNovel(expandedNovel === novel.id ? null : novel.id)}
                className="text-gray-600 hover:text-gray-800 flex items-center"
              >
                {expandedNovel === novel.id ? <FiChevronUp /> : <FiChevronDown />}
              </button>
              <button 
                onClick={() => onDelete(novel.id)}
                className="text-red-600 hover:text-red-800 flex items-center"
              >
                <FiTrash className="mr-1" /> Delete
              </button>
            </div>
          </div>
          {expandedNovel === novel.id && novel.chapters && novel.chapters.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Chapters</h4>
              <div className="max-h-48 overflow-y-auto">
                {novel.chapters.map((chapter, index) => (
                  <Link
                    key={index}
                    href={`/translate/${novel.id}/${index+1}`}
                    className="block py-1 text-sm text-gray-600 hover:text-blue-600"
                  >
                    {chapter.title ? `${index + 1}: ${chapter.title}` : `Chapter ${index + 1}`}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NovelList;

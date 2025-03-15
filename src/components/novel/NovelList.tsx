import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FiBook,
  FiEdit,
  FiTrash,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { Novel } from '@/types';
import { getChapterTOC } from '@/services/storage';

interface NovelListProps {
  novels: Novel[];
  onDelete: (id: string) => void;
}

interface ChapterMetadata {
  number: number;
  title: string;
}

const NovelList: React.FC<NovelListProps> = ({ novels, onDelete }) => {
  const [expandedNovel, setExpandedNovel] = useState<string | null>(null);
  const [chapterTOC, setChapterTOC] = useState<
    Record<string, ChapterMetadata[]>
  >({});

  useEffect(() => {
    const loadTOC = async (novelId: string) => {
      if (expandedNovel === novelId && !chapterTOC[novelId]) {
        const metadata = await getChapterTOC(novelId);
        setChapterTOC((prev) => ({ ...prev, [novelId]: metadata }));
      }
    };

    if (expandedNovel) {
      loadTOC(expandedNovel);
    }
  }, [expandedNovel, chapterTOC]);

  if (!novels || novels.length === 0) {
    return (
      <div className="py-10 text-center">
        <FiBook className="mx-auto text-4xl text-gray-400" />
        <p className="mt-4 text-gray-500">
          No novels found. Create your first translation project.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {novels.map((novel) => (
        <div
          key={novel.id}
          className="rounded-lg border p-4 transition hover:shadow-md"
        >
          <h3 className="text-lg font-bold">{novel.title}</h3>
          <div className="my-2 text-sm text-gray-500">
            {novel.sourceLanguage} → {novel.targetLanguage}
          </div>
          <div className="text-sm text-gray-500">
            {novel.chapterCount || 0} chapters translated
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Link
              href={`/translate/${novel.id}`}
              className="flex items-center text-blue-600 hover:underline"
            >
              <FiEdit className="mr-1" /> Continue
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setExpandedNovel(expandedNovel === novel.id ? null : novel.id)
                }
                className="flex items-center text-gray-600 hover:text-gray-800"
              >
                {expandedNovel === novel.id ? (
                  <FiChevronUp />
                ) : (
                  <FiChevronDown />
                )}
              </button>
              <button
                onClick={() => onDelete(novel.id)}
                className="flex items-center text-red-600 hover:text-red-800"
              >
                <FiTrash className="mr-1" /> Delete
              </button>
            </div>
          </div>
          {expandedNovel === novel.id && chapterTOC[novel.id]?.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-sm font-semibold">Chapters</h4>
              <div className="max-h-48 overflow-y-auto">
                {chapterTOC[novel.id].map((chapter) => (
                  <Link
                    key={chapter.number}
                    href={`/translate/${novel.id}/${chapter.number}`}
                    className="block py-1 text-sm text-gray-600 hover:text-blue-600"
                  >
                    {chapter.title
                      ? `${chapter.number}: ${chapter.title}`
                      : `Chapter ${chapter.number}`}
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

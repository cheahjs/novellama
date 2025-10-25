import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBook,
  FiEdit,
  FiTrash,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { Novel, NovelSortUpdate } from '@/types';
import { getChapterTOC } from '@/services/storage';

interface NovelListProps {
  novels: Novel[];
  onDelete: (id: string) => void;
  onReorder: (updates: NovelSortUpdate[]) => void;
}

interface ChapterMetadata {
  number: number;
  title: string;
}

const NovelList: React.FC<NovelListProps> = ({ novels, onDelete, onReorder }) => {
  const [expandedNovel, setExpandedNovel] = useState<string | null>(null);
  const [chapterTOC, setChapterTOC] = useState<Record<string, ChapterMetadata[]>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const orderedNovels = useMemo(() => {
    const normalize = (value: number | null | undefined, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;

    return [...novels].sort((a, b) => {
      const aOrder = normalize(a.sortOrder, Number.MAX_SAFE_INTEGER);
      const bOrder = normalize(b.sortOrder, Number.MAX_SAFE_INTEGER);

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aCreated = normalize(a.createdAt, Number.MAX_SAFE_INTEGER);
      const bCreated = normalize(b.createdAt, Number.MAX_SAFE_INTEGER);
      return aCreated - bCreated;
    });
  }, [novels]);

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

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    novelId: string,
  ) => {
    // Required for Firefox to allow dropping
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', novelId);
    setDraggedId(novelId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    const activeId = draggedId ?? event.dataTransfer.getData('text/plain');
    if (!activeId || activeId === targetId) {
      handleDragEnd();
      return;
    }

    const currentOrder = orderedNovels.map((novel) => novel.id);
    const fromIndex = currentOrder.indexOf(activeId);
    const toIndex = currentOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      handleDragEnd();
      return;
    }

    const reordered = [...currentOrder];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updates = reordered.map((id, index) => ({
      id,
      sortOrder: index,
    }));
    onReorder(updates);
    handleDragEnd();
  };

  if (!orderedNovels || orderedNovels.length === 0) {
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
      {orderedNovels.map((novel) => (
        <div
          key={novel.id}
          className={`rounded-lg border p-4 transition hover:shadow-md ${
            draggedId === novel.id ? 'border-blue-500 shadow-lg' : ''
          }`}
          draggable
          onDragStart={(event) => handleDragStart(event, novel.id)}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, novel.id)}
          onDragEnd={handleDragEnd}
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
              href={`/translate/${novel.slug || novel.id}`}
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
                    href={`/translate/${novel.slug || novel.id}/${chapter.number}`}
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

import { Novel, TranslationChunk } from '@/types';

const NOVELS_STORAGE_KEY = 'novellama_novels';

export const saveNovel = (novel: Novel): void => {
  if (typeof window !== 'undefined') {
    const existingNovels = getNovels();
    const novelIndex = existingNovels.findIndex(n => n.id === novel.id);
    
    if (novelIndex >= 0) {
      existingNovels[novelIndex] = { ...novel, updatedAt: Date.now() };
    } else {
      existingNovels.push(novel);
    }
    
    localStorage.setItem(NOVELS_STORAGE_KEY, JSON.stringify(existingNovels));
  }
};

export const getNovels = (): Novel[] => {
  if (typeof window !== 'undefined') {
    const novelsJson = localStorage.getItem(NOVELS_STORAGE_KEY);
    if (novelsJson) {
      try {
        return JSON.parse(novelsJson);
      } catch (e) {
        console.error('Failed to parse novels from localStorage', e);
      }
    }
  }
  return [];
};

export const getNovel = (id: string): Novel | null => {
  const novels = getNovels();
  return novels.find(novel => novel.id === id) || null;
};

export const deleteNovel = (id: string): void => {
  if (typeof window !== 'undefined') {
    const novels = getNovels().filter(novel => novel.id !== id);
    localStorage.setItem(NOVELS_STORAGE_KEY, JSON.stringify(novels));
  }
};

export const addChunkToNovel = (novelId: string, chunk: TranslationChunk): void => {
  const novel = getNovel(novelId);
  if (novel) {
    novel.chunks.push(chunk);
    novel.updatedAt = Date.now();
    saveNovel(novel);
  }
};

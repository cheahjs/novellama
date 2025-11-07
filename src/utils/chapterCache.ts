import { TranslationChapter } from '@/types';

const CHAPTER_CACHE_PREFIX = 'novellama:chapter:v1:';
const CHAPTER_CACHE_INDEX_KEY = 'novellama:chapter:index:v1';
const MAX_CACHED_CHAPTERS = 200;

type ChapterCacheIndexEntry = {
  key: string;
  updatedAt: number;
};

type StoredChapterPayload = {
  chapter: TranslationChapter;
  cachedAt: number;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Chapter cache unavailable (storage access failed).', error);
    return null;
  }
}

function makeKey(novelId: string, chapterNumber: number): string {
  return `${CHAPTER_CACHE_PREFIX}${novelId}:${chapterNumber}`;
}

function readIndex(storage: Storage): ChapterCacheIndexEntry[] {
  const raw = storage.getItem(CHAPTER_CACHE_INDEX_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ChapterCacheIndexEntry =>
        entry && typeof entry.key === 'string' && typeof entry.updatedAt === 'number',
    );
  } catch (error) {
    console.warn('Failed to parse chapter cache index; resetting.', error);
    storage.removeItem(CHAPTER_CACHE_INDEX_KEY);
    return [];
  }
}

function writeIndex(storage: Storage, index: ChapterCacheIndexEntry[]): void {
  try {
    storage.setItem(CHAPTER_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn('Failed to persist chapter cache index.', error);
  }
}

function pruneIndex(storage: Storage, index: ChapterCacheIndexEntry[]): ChapterCacheIndexEntry[] {
  const pruned = [...index].sort((a, b) => b.updatedAt - a.updatedAt);

  while (pruned.length > MAX_CACHED_CHAPTERS) {
    const removed = pruned.pop();
    if (removed) {
      storage.removeItem(removed.key);
    }
  }

  return pruned;
}

function touchIndex(storage: Storage, key: string): void {
  const now = Date.now();
  const filteredIndex = readIndex(storage).filter((entry) => entry.key !== key);
  const updatedIndex = pruneIndex(storage, [{ key, updatedAt: now }, ...filteredIndex]);
  writeIndex(storage, updatedIndex);
}

function removeFromIndex(storage: Storage, key: string): void {
  const filteredIndex = readIndex(storage).filter((entry) => entry.key !== key);
  writeIndex(storage, filteredIndex);
}

export function cacheChapter(novelId: string, chapter: TranslationChapter): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const key = makeKey(novelId, chapter.number);
  const payload: StoredChapterPayload = {
    chapter,
    cachedAt: Date.now(),
  };

  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to cache chapter; clearing space and retrying once.', error);

    // Try pruning the cache and retry once
    const index = pruneIndex(storage, readIndex(storage));
    writeIndex(storage, index);

    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (retryError) {
      console.warn('Failed to cache chapter after pruning.', retryError);
      return;
    }
  }

  touchIndex(storage, key);
}

export function getCachedChapter(
  novelId: string,
  chapterNumber: number,
): TranslationChapter | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const key = makeKey(novelId, chapterNumber);
  const raw = storage.getItem(key);
  if (!raw) {
    removeFromIndex(storage, key);
    return null;
  }

  try {
    const payload = JSON.parse(raw) as StoredChapterPayload;
    if (!payload || typeof payload !== 'object' || !payload.chapter) {
      storage.removeItem(key);
      removeFromIndex(storage, key);
      return null;
    }

    touchIndex(storage, key);
    return payload.chapter;
  } catch (error) {
    console.warn('Failed to read cached chapter; removing corrupt entry.', error);
    storage.removeItem(key);
    removeFromIndex(storage, key);
    return null;
  }
}

export function removeCachedChapter(novelId: string, chapterNumber: number): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const key = makeKey(novelId, chapterNumber);
  storage.removeItem(key);
  removeFromIndex(storage, key);
}

export function clearChapterCacheForNovel(novelId: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const index = readIndex(storage).filter((entry) => {
    const shouldKeep = !entry.key.startsWith(`${CHAPTER_CACHE_PREFIX}${novelId}:`);
    if (!shouldKeep) {
      storage.removeItem(entry.key);
    }
    return shouldKeep;
  });

  writeIndex(storage, index);
}


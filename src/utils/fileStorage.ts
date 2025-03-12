import fs from 'fs/promises';
import path from 'path';
import { Novel, NovelWithChapters } from '@/types';
import { getChapters, deleteNovelChapters, listChapters } from './chapterStorage';

const DATA_FILE = path.join(process.cwd(), 'data', 'novels.json');
const WRITE_DEBOUNCE_MS = 1000;

let novelsCache: Novel[] = [];
let lastWrite = 0;

// Ensure data file exists
async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]');
  }
}

// Read all novels from file (without chapters)
export async function readNovels(): Promise<Novel[]> {
  // Return cached novels if available
  if (novelsCache.length > 0) {
    return novelsCache;
  }

  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  novelsCache = JSON.parse(data);
  return novelsCache;
}

// Write novels to file with debouncing
export async function writeNovels(novels: Novel[]): Promise<void> {
  await ensureDataFile();

  // Update cache immediately
  novelsCache = novels;

  // Debounce disk writes
  const now = Date.now();
  if (now - lastWrite < WRITE_DEBOUNCE_MS) {
    return;
  }

  lastWrite = now;
  await fs.writeFile(DATA_FILE, JSON.stringify(novels, null, 2));
}

// Get a single novel by ID with optional chapter range
export async function getNovelById(
  id: string,
  chapterRange?: { start: number; end: number }
): Promise<NovelWithChapters | null> {
  const novels = await readNovels();
  const novel = novels.find((novel) => novel.id === id);
  
  if (!novel) return null;

  // If no chapter range is specified, get all chapters
  if (!chapterRange) {
    const chapterNumbers = await listChapters(id);
    const chapters = await getChapters(id, 1, Math.max(...chapterNumbers, 0));
    return { ...novel, chapters };
  }

  // Get specified chapter range
  const chapters = await getChapters(id, chapterRange.start, chapterRange.end);
  return { ...novel, chapters };
}

// Save a novel (create or update)
export async function saveNovel(novel: Novel): Promise<Novel> {
  const novels = await readNovels();
  const index = novels.findIndex((n) => n.id === novel.id);

  // Create base novel object without chapters
  const baseNovel: Novel = {
    ...novel,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    novels[index] = baseNovel;
  } else {
    novels.push(baseNovel);
  }

  await writeNovels(novels);
  return baseNovel;
}

// Delete a novel and all its chapters
export async function deleteNovel(id: string): Promise<void> {
  const novels = await readNovels();
  const filteredNovels = novels.filter((novel) => novel.id !== id);
  await writeNovels(filteredNovels);
  await deleteNovelChapters(id);
}

// Clear cache (useful for testing or when needed)
export function clearCache(): void {
  novelsCache = [];
  lastWrite = 0;
}

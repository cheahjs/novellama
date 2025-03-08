import fs from 'fs/promises';
import path from 'path';
import { Novel } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'novels.json');

// In-memory cache
let novelsCache: Novel[] = [];
let lastWrite = 0;
const WRITE_DEBOUNCE_MS = 1000; // Debounce writes by 1 second

// Ensure the data directory and file exist
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    // If file doesn't exist, create it with empty array
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
}

// Read all novels from file
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

// Get a single novel by ID
export async function getNovelById(id: string): Promise<Novel | null> {
  const novels = await readNovels();
  return novels.find(novel => novel.id === id) || null;
}

// Save a novel (create or update)
export async function saveNovel(novel: Novel): Promise<Novel> {
  const novels = await readNovels();
  const index = novels.findIndex(n => n.id === novel.id);
  
  if (index >= 0) {
    novels[index] = { ...novel, updatedAt: Date.now() };
  } else {
    novels.push(novel);
  }
  
  await writeNovels(novels);
  return novel;
}

// Delete a novel
export async function deleteNovel(id: string): Promise<void> {
  const novels = await readNovels();
  const filteredNovels = novels.filter(novel => novel.id !== id);
  await writeNovels(filteredNovels);
}

// Clear cache (useful for testing or when needed)
export function clearCache(): void {
  novelsCache = [];
  lastWrite = 0;
} 
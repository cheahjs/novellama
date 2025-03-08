import fs from 'fs/promises';
import path from 'path';
import { Novel } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'novels.json');

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
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

// Write novels to file
export async function writeNovels(novels: Novel[]): Promise<void> {
  await ensureDataFile();
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
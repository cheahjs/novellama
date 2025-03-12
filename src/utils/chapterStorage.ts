import fs from 'fs/promises';
import path from 'path';
import { TranslationChapter } from '@/types';

const CHAPTERS_DIR = path.join(process.cwd(), 'data', 'chapters');

// Ensure the chapters directory exists
async function ensureChaptersDir(novelId: string): Promise<void> {
  const novelChaptersDir = path.join(CHAPTERS_DIR, novelId);
  await fs.mkdir(novelChaptersDir, { recursive: true });
}

// Save a single chapter
export async function saveChapter(novelId: string, chapter: TranslationChapter): Promise<void> {
  await ensureChaptersDir(novelId);
  const chapterPath = path.join(CHAPTERS_DIR, novelId, `${chapter.number}.json`);
  await fs.writeFile(chapterPath, JSON.stringify(chapter, null, 2));
}

// Get a single chapter
export async function getChapter(novelId: string, chapterNumber: number): Promise<TranslationChapter | null> {
  try {
    const chapterPath = path.join(CHAPTERS_DIR, novelId, `${chapterNumber}.json`);
    const data = await fs.readFile(chapterPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Get multiple chapters
export async function getChapters(novelId: string, startNumber: number, endNumber: number): Promise<TranslationChapter[]> {
  const chapters: TranslationChapter[] = [];
  for (let i = startNumber; i <= endNumber; i++) {
    const chapter = await getChapter(novelId, i);
    if (chapter) {
      chapters.push(chapter);
    }
  }
  return chapters;
}

// Delete a chapter
export async function deleteChapter(novelId: string, chapterNumber: number): Promise<void> {
  try {
    const chapterPath = path.join(CHAPTERS_DIR, novelId, `${chapterNumber}.json`);
    await fs.unlink(chapterPath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

// Delete all chapters for a novel
export async function deleteNovelChapters(novelId: string): Promise<void> {
  try {
    const novelChaptersDir = path.join(CHAPTERS_DIR, novelId);
    await fs.rm(novelChaptersDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }
}

// List all chapters for a novel
export async function listChapters(novelId: string): Promise<number[]> {
  try {
    const novelChaptersDir = path.join(CHAPTERS_DIR, novelId);
    const files = await fs.readdir(novelChaptersDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => parseInt(file.replace('.json', '')))
      .sort((a, b) => a - b);
  } catch (error) {
    return [];
  }
}

// Get chapter metadata for table of contents
export async function getChapterMetadata(novelId: string): Promise<Array<{ number: number; title: string }>> {
  try {
    const novelChaptersDir = path.join(CHAPTERS_DIR, novelId);
    const files = await fs.readdir(novelChaptersDir);
    
    const chapterMetadata = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const chapterPath = path.join(novelChaptersDir, file);
          const data = await fs.readFile(chapterPath, 'utf-8');
          const chapter = JSON.parse(data) as TranslationChapter;
          return {
            number: chapter.number,
            title: chapter.title
          };
        })
    );

    // Sort by chapter number
    return chapterMetadata.sort((a, b) => a.number - b.number);
  } catch (error) {
    return [];
  }
} 
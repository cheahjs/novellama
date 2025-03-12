import * as fs from 'fs/promises';
import * as path from 'path';
import getDb from '../src/utils/db.js';
import { nanoid } from 'nanoid';

const DATA_DIR = path.join(process.cwd(), 'data');
const NOVELS_FILE = path.join(DATA_DIR, 'novels.json');
const CHAPTERS_DIR = path.join(DATA_DIR, 'chapters');

interface Reference {
  id: string;
  title: string;
  content: string;
  tokenCount?: number;
}

interface QualityCheck {
  score: number;
  feedback: string;
  isGoodQuality: boolean;
}

interface Chapter {
  id?: string;
  number: number;
  title: string;
  sourceContent: string;
  translatedContent: string;
  createdAt: number;
  updatedAt: number;
  qualityCheck?: QualityCheck;
}

interface Novel {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt: string;
  sourceUrl: string;
  translationTemplate?: string;
  chapterCount?: number;
  createdAt: number;
  updatedAt: number;
  references: Reference[];
}

async function migrateToSqlite(): Promise<void> {
  try {
    console.log('Starting migration to SQLite...');

    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Check if novels file exists
    try {
      await fs.access(NOVELS_FILE);
    } catch {
      console.log('No existing novels file found. Starting with fresh database.');
      return;
    }

    // Read novels from JSON file
    console.log('Reading novels from JSON file...');
    const novelsData = await fs.readFile(NOVELS_FILE, 'utf-8');
    const novels: Novel[] = JSON.parse(novelsData);

    // Get database connection
    const db = getDb();

    // Start transaction
    const transaction = db.transaction(async () => {
      // Migrate each novel
      for (const novel of novels) {
        console.log(`Migrating novel: ${novel.title}`);

        // Insert novel
        db.prepare(`
          INSERT INTO novels (
            id, title, sourceLanguage, targetLanguage,
            systemPrompt, sourceUrl, translationTemplate,
            chapterCount, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          novel.id,
          novel.title,
          novel.sourceLanguage,
          novel.targetLanguage,
          novel.systemPrompt,
          novel.sourceUrl,
          novel.translationTemplate || null,
          novel.chapterCount || 0,
          novel.createdAt,
          novel.updatedAt
        );

        // Insert references
        const insertReference = db.prepare(`
          INSERT INTO "references" (
            id, novelId, title, content, tokenCount
          ) VALUES (?, ?, ?, ?, ?)
        `);

        for (const ref of novel.references) {
          insertReference.run(
            ref.id,
            novel.id,
            ref.title,
            ref.content,
            ref.tokenCount || null
          );
        }

        // Migrate chapters
        const novelChaptersDir = path.join(CHAPTERS_DIR, novel.id);
        console.log(`Migrating chapters for novel: ${novel.title} (from ${novelChaptersDir})`);
        try {
          const chapterFiles = await fs.readdir(novelChaptersDir);
          
          for (const file of chapterFiles) {
            if (!file.endsWith('.json')) continue;

            const chapterData = await fs.readFile(
              path.join(novelChaptersDir, file),
              'utf-8'
            );
            const chapter: Chapter = JSON.parse(chapterData);

            console.log(`Migrating chapter: ${chapter.title}`);
            const newChapterId = nanoid();

            // Insert chapter
            db.prepare(`
              INSERT INTO chapters (
                id, novelId, number, title,
                sourceContent, translatedContent,
                createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              newChapterId,
              novel.id,
              chapter.number,
              chapter.title,
              chapter.sourceContent,
              chapter.translatedContent,
              chapter.createdAt,
              chapter.updatedAt
            );

            // Insert quality check if exists
            if (chapter.qualityCheck) {
              db.prepare(`
                INSERT INTO quality_checks (
                  chapterId, score, feedback,
                  isGoodQuality, createdAt
                ) VALUES (?, ?, ?, ?, ?)
              `).run(
                newChapterId,
                chapter.qualityCheck.score,
                chapter.qualityCheck.feedback,
                chapter.qualityCheck.isGoodQuality ? 1 : 0,
                chapter.updatedAt // Use chapter's updatedAt as createdAt for quality check
              );
            }
          }
        } catch (error: unknown) {
          console.warn(`No chapters found for novel: ${novel.title} ${error}`);
        }
      }
    });

    // Execute transaction
    await transaction();

    // Backup old files
    const timestamp = Date.now();
    const backupDir = path.join(DATA_DIR, `backup-${timestamp}`);
    // await fs.mkdir(backupDir, { recursive: true });

    // console.log('\nBacking up old files...');
    // try {
    //   await fs.rename(NOVELS_FILE, path.join(backupDir, 'novels.json'));
    // } catch (error: unknown) {
    //   console.warn('Could not backup novels file:', error);
    // }

    // try {
    //   await fs.rename(CHAPTERS_DIR, path.join(backupDir, 'chapters'));
    // } catch (error: unknown) {
    //   console.warn('Could not backup chapters directory:', error);
    // }

    console.log('\nMigration completed successfully!');
    console.log(`- Migrated ${novels.length} novels`);
    console.log(`- Old data backed up to: ${backupDir}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToSqlite().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 
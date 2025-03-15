import fs from 'fs/promises';
import path from 'path';
import type { Novel, NovelWithChapters } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const OLD_NOVELS_FILE = path.join(DATA_DIR, 'novels.json');
const CHAPTERS_DIR = path.join(DATA_DIR, 'chapters');

async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(CHAPTERS_DIR, { recursive: true });
}

async function migrateNovels() {
  try {
    console.log('Starting novel migration...');
    await ensureDirectories();

    // Read the old novels file
    console.log('Reading old novels file...');
    const oldData = await fs.readFile(OLD_NOVELS_FILE, 'utf-8');
    const oldNovels = JSON.parse(oldData) as NovelWithChapters[];

    // Process each novel
    const migratedNovels: Novel[] = [];
    for (const oldNovel of oldNovels) {
      console.log(`\nMigrating novel: ${oldNovel.title}`);

      // Create novel directory in chapters
      const novelChaptersDir = path.join(CHAPTERS_DIR, oldNovel.id);
      await fs.mkdir(novelChaptersDir, { recursive: true });

      // Save each chapter as a separate file
      if (oldNovel.chapters) {
        for (const chapter of oldNovel.chapters) {
          const chapterPath = path.join(
            novelChaptersDir,
            `${chapter.number}.json`,
          );
          console.log(`  - Saving chapter ${chapter.number}`);
          await fs.writeFile(chapterPath, JSON.stringify(chapter, null, 2));
        }
      }

      // Create new novel object without chapters
      const { chapters, ...novelWithoutChapters } = oldNovel;
      const newNovel: Novel = {
        ...novelWithoutChapters,
        chapterCount: chapters?.length || 0,
      };

      migratedNovels.push(newNovel);
    }

    // Backup old novels file
    const backupPath = path.join(DATA_DIR, `novels.backup-${Date.now()}.json`);
    console.log('\nBacking up old novels file to:', backupPath);
    await fs.copyFile(OLD_NOVELS_FILE, backupPath);

    // Save new novels file
    console.log('Saving migrated novels...');
    await fs.writeFile(
      OLD_NOVELS_FILE,
      JSON.stringify(migratedNovels, null, 2),
    );

    console.log('\nMigration completed successfully!');
    console.log(`- Migrated ${migratedNovels.length} novels`);
    console.log(`- Old data backed up to: ${backupPath}`);
    console.log(`- Chapters stored in: ${CHAPTERS_DIR}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateNovels();

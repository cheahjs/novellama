import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'novellama.db');

// Initialize database connection
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    initializeDb();
  }
  return db;
}

// Initialize database schema
function initializeDb() {
  const db = getDb();

  // Improve concurrency and reduce lock contention
  // - WAL allows concurrent readers during writes
  // - busy_timeout makes readers wait for a short period instead of failing immediately
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');

  // Create novels table
  db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sourceLanguage TEXT NOT NULL,
      targetLanguage TEXT NOT NULL,
      systemPrompt TEXT NOT NULL,
      sourceUrl TEXT NOT NULL,
      translationTemplate TEXT,
      translationModel TEXT,
      qualityCheckModel TEXT,
      maxTokens INTEGER,
      maxTranslationOutputTokens INTEGER,
      maxQualityCheckOutputTokens INTEGER,
      chapterCount INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Migrate existing databases by adding missing columns
  const existingColumns = db.prepare(`PRAGMA table_info(novels)`).all() as Array<{ name: string }>;
  const columnNames = new Set(existingColumns.map((c) => c.name));
  const addColumnIfMissing = (name: string, type: 'TEXT' | 'INTEGER') => {
    if (!columnNames.has(name)) {
      db.exec(`ALTER TABLE novels ADD COLUMN ${name} ${type}`);
    }
  };
  addColumnIfMissing('translationModel', 'TEXT');
  addColumnIfMissing('qualityCheckModel', 'TEXT');
  addColumnIfMissing('maxTokens', 'INTEGER');
  addColumnIfMissing('maxTranslationOutputTokens', 'INTEGER');
  addColumnIfMissing('maxQualityCheckOutputTokens', 'INTEGER');

  // Create references table
  db.exec(`
    CREATE TABLE IF NOT EXISTS "references" (
      id TEXT PRIMARY KEY,
      novelId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tokenCount INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      createdInChapterNumber INTEGER,
      updatedInChapterNumber INTEGER,
      FOREIGN KEY (novelId) REFERENCES novels(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing references table columns if needed
  const existingReferenceColumns = db.prepare(`PRAGMA table_info("references")`).all() as Array<{ name: string }>;
  const referenceColumnNames = new Set(existingReferenceColumns.map((c) => c.name));
  const addReferenceColumnIfMissing = (name: string, type: 'INTEGER' | 'TEXT') => {
    if (!referenceColumnNames.has(name)) {
      db.exec(`ALTER TABLE "references" ADD COLUMN ${name} ${type}`);
      referenceColumnNames.add(name);
    }
  };
  addReferenceColumnIfMissing('createdAt', 'INTEGER');
  addReferenceColumnIfMissing('updatedAt', 'INTEGER');
  addReferenceColumnIfMissing('createdInChapterNumber', 'INTEGER');
  addReferenceColumnIfMissing('updatedInChapterNumber', 'INTEGER');

  // Create reference_revisions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reference_revisions (
      id TEXT PRIMARY KEY,
      referenceId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      chapterNumber INTEGER,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (referenceId) REFERENCES "references"(id) ON DELETE CASCADE
    )
  `);

  // Create chapters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      novelId TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      sourceContent TEXT NOT NULL,
      translatedContent TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (novelId) REFERENCES novels(id) ON DELETE CASCADE,
      UNIQUE(novelId, number)
    )
  `);

  // Create quality_checks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quality_checks (
      chapterId TEXT NOT NULL,
      score INTEGER,
      feedback TEXT,
      isGoodQuality BOOLEAN NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `);

  // Create chapter_revisions table to track historical changes to chapters
  db.exec(`
    CREATE TABLE IF NOT EXISTS chapter_revisions (
      id TEXT PRIMARY KEY,
      chapterId TEXT NOT NULL,
      title TEXT NOT NULL,
      sourceContent TEXT NOT NULL,
      translatedContent TEXT NOT NULL,
      qualityScore INTEGER,
      qualityFeedback TEXT,
      qualityIsGood BOOLEAN NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `);

  // Helpful index for fetching revisions in order for a chapter
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chapter_revisions_chapterId_createdAt
    ON chapter_revisions (chapterId, createdAt)
  `);

  // Enable foreign key support
  db.exec('PRAGMA foreign_keys = ON');
}

// Close database connection when the process exits
process.on('exit', () => {
  if (db) {
    db.close();
  }
});

export default getDb;

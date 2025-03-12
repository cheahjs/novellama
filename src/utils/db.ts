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
      chapterCount INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Create references table
  db.exec(`
    CREATE TABLE IF NOT EXISTS "references" (
      id TEXT PRIMARY KEY,
      novelId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tokenCount INTEGER,
      FOREIGN KEY (novelId) REFERENCES novels(id) ON DELETE CASCADE
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

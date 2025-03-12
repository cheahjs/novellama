import {
  Novel,
  NovelWithChapters,
  Reference,
  TranslationChapter,
} from '@/types';
import getDb from './db';

// Read all novels from database (without chapters)
export async function readNovels(): Promise<Novel[]> {
  const db = getDb();
  const novels = db
    .prepare(
      `
    SELECT n.*, COUNT(r.id) as referenceCount
    FROM novels n
    LEFT JOIN "references" r ON n.id = r.novelId
    GROUP BY n.id
  `,
    )
    .all() as Novel[];

  // Fetch references for each novel
  for (const novel of novels) {
    const references = db
      .prepare(
        `
      SELECT * FROM "references" WHERE novelId = ?
    `,
      )
      .all(novel.id) as Reference[];
    novel.references = references;
  }

  return novels;
}

// Get a single novel by ID with optional chapter range
export async function getNovelById(
  id: string,
  chapterRange?: { start: number; end: number },
): Promise<NovelWithChapters | null> {
  const db = getDb();

  // Get novel
  const novel = db
    .prepare(
      `
    SELECT * FROM novels WHERE id = ?
  `,
    )
    .get(id) as Novel | undefined;

  if (!novel) return null;

  // Get references
  novel.references = db
    .prepare(
      `
    SELECT * FROM "references" WHERE novelId = ?
  `,
    )
    .all(id) as Reference[];

  // Get chapters based on range
  let chaptersQuery = `
    SELECT * FROM chapters 
    WHERE novelId = ?
  `;

  const params: (string | number)[] = [id];

  if (chapterRange) {
    chaptersQuery += ` AND number BETWEEN ? AND ?`;
    params.push(chapterRange.start, chapterRange.end);
  }

  chaptersQuery += ` ORDER BY number`;

  const chapters = db
    .prepare(chaptersQuery)
    .all(...params) as TranslationChapter[];

  // Get quality checks for chapters
  for (const chapter of chapters) {
    const qualityCheck = db
      .prepare(
        `
      SELECT * FROM quality_checks 
      WHERE chapterId = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `,
      )
      .get(chapter.id) as
      | { score: number; feedback: string; isGoodQuality: boolean }
      | undefined;

    if (qualityCheck) {
      chapter.qualityCheck = {
        isGoodQuality: qualityCheck.isGoodQuality,
        score: qualityCheck.score,
        feedback: qualityCheck.feedback,
      };
    }
  }

  return { ...novel, chapters };
}

// Save a novel (create or update)
export async function saveNovel(novel: Novel): Promise<Novel> {
  const db = getDb();
  const now = Date.now();

  // Start transaction
  const transaction = db.transaction((novel: Novel) => {
    // Upsert novel
    db.prepare(
      `
      INSERT INTO novels (
        id, title, sourceLanguage, targetLanguage,
        systemPrompt, sourceUrl, translationTemplate,
        chapterCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        sourceLanguage = excluded.sourceLanguage,
        targetLanguage = excluded.targetLanguage,
        systemPrompt = excluded.systemPrompt,
        sourceUrl = excluded.sourceUrl,
        translationTemplate = excluded.translationTemplate,
        chapterCount = excluded.chapterCount,
        updatedAt = excluded.updatedAt
    `,
    ).run(
      novel.id,
      novel.title,
      novel.sourceLanguage,
      novel.targetLanguage,
      novel.systemPrompt,
      novel.sourceUrl,
      novel.translationTemplate || null,
      novel.chapterCount || 0,
      now,
      now,
    );

    // Delete existing references
    db.prepare(`DELETE FROM "references" WHERE novelId = ?`).run(novel.id);

    // Insert new references
    const insertReference = db.prepare(`
      INSERT INTO "references" (id, novelId, title, content, tokenCount)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const ref of novel.references) {
      insertReference.run(
        ref.id,
        novel.id,
        ref.title,
        ref.content,
        ref.tokenCount || null,
      );
    }

    return novel;
  });

  // Execute transaction
  return transaction(novel);
}

// Delete a novel and all its associated data
export async function deleteNovel(id: string): Promise<void> {
  const db = getDb();

  // The foreign key constraints will handle cascading deletes
  db.prepare(`DELETE FROM novels WHERE id = ?`).run(id);
}

// Clear cache (no longer needed with SQLite)
export function clearCache(): void {
  // No-op as we don't use caching with SQLite
}

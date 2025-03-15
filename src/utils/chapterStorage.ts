import { TranslationChapter } from '@/types';
import getDb from './db';
import { nanoid } from 'nanoid';

// Save a single chapter
export async function saveChapter(
  novelId: string,
  chapter: TranslationChapter,
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // Start transaction
  const transaction = db.transaction(() => {
    // First check if the novel exists
    const novel = db.prepare(
      `SELECT id FROM novels WHERE id = ?`
    ).get(novelId);

    if (!novel) {
      throw new Error(`Novel with ID ${novelId} not found`);
    }

    // Generate or use existing chapter ID
    const chapterId = chapter.id || nanoid();

    // First, insert or update the chapter and get the result
    const chapterResult = db.prepare(
      `
      INSERT INTO chapters (
        id, novelId, number, title,
        sourceContent, translatedContent,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(novelId, number) DO UPDATE SET
        id = excluded.id,
        title = excluded.title,
        sourceContent = excluded.sourceContent,
        translatedContent = excluded.translatedContent,
        updatedAt = excluded.updatedAt
      RETURNING id
    `,
    ).get(
      chapterId,
      novelId,
      chapter.number,
      chapter.title,
      chapter.sourceContent,
      chapter.translatedContent,
      chapter.createdAt || now,
      now,
    ) as { id: string };

    // If there's a quality check, save it using the confirmed chapter ID
    if (chapter.qualityCheck) {
      // First delete any existing quality checks for this chapter
      db.prepare(
        `DELETE FROM quality_checks WHERE chapterId = ?`
      ).run(chapterResult.id);

      // Then insert the new quality check
      db.prepare(
        `
        INSERT INTO quality_checks (
          chapterId, score, feedback,
          isGoodQuality, createdAt
        ) VALUES (?, ?, ?, ?, ?)
      `,
      ).run(
        chapterResult.id,
        chapter.qualityCheck.score,
        chapter.qualityCheck.feedback,
        chapter.qualityCheck.isGoodQuality ? 1 : 0,
        now,
      );
    }

    // Update novel's chapter count
    const chapterCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM chapters WHERE novelId = ?
    `,
      )
      .get(novelId) as { count: number };

    db.prepare(
      `
      UPDATE novels 
      SET chapterCount = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(chapterCount.count, now, novelId);
  });

  // Execute transaction
  transaction();
}

// Get a single chapter
export async function getChapter(
  novelId: string,
  chapterNumber: number,
): Promise<TranslationChapter | null> {
  const db = getDb();

  // Get chapter
  const chapter = db
    .prepare(
      `
    SELECT * FROM chapters 
    WHERE novelId = ? AND number = ?
  `,
    )
    .get(novelId, chapterNumber) as TranslationChapter | undefined;

  if (!chapter) return null;

  // Get latest quality check
  const qualityCheck = db
    .prepare(
      `
    SELECT score, feedback, isGoodQuality
    FROM quality_checks 
    WHERE chapterId = ?
    ORDER BY createdAt DESC
    LIMIT 1
  `,
    )
    .get(chapter.id) as
    | { score: number; feedback: string; isGoodQuality: number }
    | undefined;

  if (qualityCheck) {
    chapter.qualityCheck = {
      score: qualityCheck.score,
      feedback: qualityCheck.feedback,
      isGoodQuality: Boolean(qualityCheck.isGoodQuality),
    };
  }

  return chapter;
}

// Get multiple chapters
export async function getChapters(
  novelId: string,
  startNumber: number,
  endNumber: number,
): Promise<TranslationChapter[]> {
  const db = getDb();

  // Get chapters
  const chapters = db
    .prepare(
      `
    SELECT * FROM chapters 
    WHERE novelId = ? AND number BETWEEN ? AND ?
    ORDER BY number
  `,
    )
    .all(novelId, startNumber, endNumber) as TranslationChapter[];

  // Get quality checks for each chapter
  for (const chapter of chapters) {
    const qualityCheck = db
      .prepare(
        `
      SELECT score, feedback, isGoodQuality
      FROM quality_checks 
      WHERE chapterId = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `,
      )
      .get(chapter.id) as
      | { score: number; feedback: string; isGoodQuality: number }
      | undefined;

    if (qualityCheck) {
      chapter.qualityCheck = {
        score: qualityCheck.score,
        feedback: qualityCheck.feedback,
        isGoodQuality: Boolean(qualityCheck.isGoodQuality),
      };
    }
  }

  return chapters;
}

// Delete a chapter
export async function deleteChapter(
  novelId: string,
  chapterNumber: number,
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // Start transaction
  const transaction = db.transaction(() => {
    // Delete chapter (quality checks will be deleted by foreign key constraint)
    db.prepare(
      `
      DELETE FROM chapters 
      WHERE novelId = ? AND number = ?
    `,
    ).run(novelId, chapterNumber);

    // Update novel's chapter count
    const chapterCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM chapters WHERE novelId = ?
    `,
      )
      .get(novelId) as { count: number };

    db.prepare(
      `
      UPDATE novels 
      SET chapterCount = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(chapterCount.count, now, novelId);
  });

  // Execute transaction
  transaction();
}

// Delete all chapters for a novel
export async function deleteNovelChapters(novelId: string): Promise<void> {
  const db = getDb();

  // Delete all chapters (quality checks will be deleted by foreign key constraint)
  db.prepare(`DELETE FROM chapters WHERE novelId = ?`).run(novelId);
}

// List all chapters for a novel
export async function listChapters(novelId: string): Promise<number[]> {
  const db = getDb();

  const chapters = db
    .prepare(
      `
    SELECT number FROM chapters 
    WHERE novelId = ?
    ORDER BY number
  `,
    )
    .all(novelId) as { number: number }[];

  return chapters.map((chapter) => chapter.number);
}

// Get chapter metadata for table of contents
export async function getChapterMetadata(
  novelId: string,
): Promise<Array<{ number: number; title: string }>> {
  const db = getDb();

  return db
    .prepare(
      `
    SELECT number, title 
    FROM chapters 
    WHERE novelId = ?
    ORDER BY number
  `,
    )
    .all(novelId) as Array<{ number: number; title: string }>;
}

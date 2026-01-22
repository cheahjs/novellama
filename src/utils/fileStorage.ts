import {
  Novel,
  NovelWithChapters,
  Reference,
  TranslationChapter,
} from '@/types';
import getDb from './db';
import { nanoid } from 'nanoid';
import slugify from 'slugify';

interface NovelDbRow extends Omit<Novel, 'hasNewChapters' | 'translationToolCallsEnable' | 'references'> {
  hasNewChapters: number | null;
  translationToolCallsEnable: number | null;
}

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
    ORDER BY n.sortOrder ASC, n.createdAt ASC
  `,
    )
    .all() as NovelDbRow[];

  const mapNovel = (n: NovelDbRow): Novel => ({
    ...n,
    references: [],
    hasNewChapters: n.hasNewChapters === 1,
    translationToolCallsEnable: n.translationToolCallsEnable === null ? null : n.translationToolCallsEnable === 1,
  });

  const processedNovels = novels.map(mapNovel);

  // Fetch references for each novel
  for (const novel of processedNovels) {
    const references = db
      .prepare(
        `
      SELECT * FROM "references" WHERE novelId = ?
    `,
      )
      .all(novel.id) as Reference[];
    novel.references = references;
  }

  return processedNovels;
}

// Get a single novel by ID with optional chapter range
export async function getNovelById(
  idOrSlug: string,
  chapterRange?: { start: number; end: number },
): Promise<NovelWithChapters | null> {
  const db = getDb();

  // Get novel
  const novel = db
    .prepare(
      `
    SELECT * FROM novels WHERE id = ? OR slug = ?
  `,
    )
    .get(idOrSlug, idOrSlug) as NovelDbRow | undefined;

  if (!novel) return null;

  const targetNovel: Novel = {
    ...novel,
    references: [],
    hasNewChapters: novel.hasNewChapters === 1,
    translationToolCallsEnable: novel.translationToolCallsEnable === null ? null : novel.translationToolCallsEnable === 1,
  };

  // Get references
  targetNovel.references = db
    .prepare(
      `
    SELECT * FROM "references" WHERE novelId = ?
  `,
    )
    .all(targetNovel.id) as Reference[];

  // Only fetch chapters if a range is specified
  if (!chapterRange) {
    return { ...targetNovel, chapters: [] };
  }

  // Get chapters based on range
  const chaptersQuery = `
    SELECT c.*, q.score, q.feedback, q.isGoodQuality
    FROM chapters c
    LEFT JOIN (
      SELECT chapterId, score, feedback, isGoodQuality
      FROM quality_checks qc1
      WHERE (
        SELECT COUNT(*)
        FROM quality_checks qc2
        WHERE qc2.chapterId = qc1.chapterId
        AND qc2.createdAt > qc1.createdAt
      ) = 0
    ) q ON c.id = q.chapterId
    WHERE c.novelId = ? AND c.number BETWEEN ? AND ?
    ORDER BY c.number
  `;

  interface ChapterRow {
    id: string;
    number: number;
    title: string;
    sourceContent: string;
    translatedContent: string;
    createdAt: number;
    updatedAt: number;
    score: number | null;
    feedback: string | null;
    isGoodQuality: number | null;
  }

  const rows = db
    .prepare(chaptersQuery)
    .all(targetNovel.id, chapterRange.start, chapterRange.end) as ChapterRow[];

  const chapters = rows.map((row) => {
    const chapter: TranslationChapter = {
      id: row.id,
      number: row.number,
      title: row.title,
      sourceContent: row.sourceContent,
      translatedContent: row.translatedContent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    if (row.score !== null) {
      chapter.qualityCheck = {
        score: row.score,
        feedback: row.feedback || '',
        isGoodQuality: Boolean(row.isGoodQuality),
      };
    }

    return chapter;
  });

  return { ...targetNovel, chapters };
}

export async function updateNovelProgress(
  id: string,
  readingChapterNumber: number | null,
): Promise<Novel | null> {
  const db = getDb();

  const existingNovel = db
    .prepare(
      `
      SELECT * FROM novels WHERE id = ?
    `,
    )
    .get(id) as (Novel & { references?: Reference[] }) | undefined;

  if (!existingNovel) {
    return null;
  }

  const now = Date.now();

  db.prepare(
    `
      UPDATE novels
      SET readingChapterNumber = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(readingChapterNumber ?? null, now, id);

  const references = db
    .prepare(
      `
      SELECT * FROM "references" WHERE novelId = ?
    `,
    )
    .all(id) as Reference[];

  return {
    ...existingNovel,
    readingChapterNumber: readingChapterNumber ?? null,
    updatedAt: now,
    references,
  };
}

// Save a novel (create or update)
export async function saveNovel(novel: Novel): Promise<Novel> {
  const db = getDb();
  const now = Date.now();

  // Start transaction
  const transaction = db.transaction((novel: Novel) => {
    const references = Array.isArray(novel.references)
      ? novel.references
      : [];

    const hasSlug = typeof novel.slug === 'string' && novel.slug.trim().length > 0;
    const slugCandidate = hasSlug
      ? slugify(novel.slug as string, { lower: true, strict: true, trim: true })
      : null;
    const normalizedSlug = slugCandidate && slugCandidate.length > 0 ? slugCandidate : null;

    const existingBySlug = normalizedSlug
      ? db
          .prepare(
            `SELECT id FROM novels WHERE slug = ? AND id != ? LIMIT 1`,
          )
          .get(normalizedSlug, novel.id)
      : null;

    if (existingBySlug) {
      throw new Error(`Slug "${normalizedSlug}" is already in use.`);
    }

    // Upsert novel
    db.prepare(
      `
      INSERT INTO novels (
        id, slug, title, sourceLanguage, targetLanguage,
        systemPrompt, sourceUrl, translationTemplate,
        translationModel, qualityCheckModel,
        translationToolCallsEnable,
        maxTokens, maxTranslationOutputTokens, maxQualityCheckOutputTokens,
        chapterCount, readingChapterNumber, hasNewChapters, createdAt, updatedAt, sortOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        sourceLanguage = excluded.sourceLanguage,
        targetLanguage = excluded.targetLanguage,
        systemPrompt = excluded.systemPrompt,
        sourceUrl = excluded.sourceUrl,
        translationTemplate = excluded.translationTemplate,
        translationModel = excluded.translationModel,
        qualityCheckModel = excluded.qualityCheckModel,
        translationToolCallsEnable = excluded.translationToolCallsEnable,
        maxTokens = excluded.maxTokens,
        maxTranslationOutputTokens = excluded.maxTranslationOutputTokens,
        maxQualityCheckOutputTokens = excluded.maxQualityCheckOutputTokens,
        chapterCount = excluded.chapterCount,
        readingChapterNumber = excluded.readingChapterNumber,
        hasNewChapters = excluded.hasNewChapters,
        updatedAt = excluded.updatedAt,
        sortOrder = excluded.sortOrder
    `,
    ).run(
      novel.id,
      normalizedSlug,
      novel.title,
      novel.sourceLanguage,
      novel.targetLanguage,
      novel.systemPrompt,
      novel.sourceUrl,
      novel.translationTemplate || null,
      novel.translationModel || null,
      novel.qualityCheckModel || null,
      novel.translationToolCallsEnable === undefined
        ? null
        : novel.translationToolCallsEnable === null
          ? null
          : novel.translationToolCallsEnable
            ? 1
            : 0,
      novel.maxTokens ?? null,
      novel.maxTranslationOutputTokens ?? null,
      novel.maxQualityCheckOutputTokens ?? null,
      novel.chapterCount || 0,
      novel.readingChapterNumber ?? null,
      novel.hasNewChapters ? 1 : 0,
      novel.createdAt ?? now,
      novel.updatedAt ?? now,
      typeof novel.sortOrder === 'number' ? novel.sortOrder : now,
    );

    // Upsert references without deleting existing, to preserve history.
    const upsertRef = db.prepare(`
      INSERT INTO "references" (
        id, novelId, title, content, tokenCount, createdAt, updatedAt,
        createdInChapterNumber, updatedInChapterNumber
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        tokenCount = excluded.tokenCount,
        updatedAt = excluded.updatedAt,
        updatedInChapterNumber = excluded.updatedInChapterNumber
    `);

    const insertRevision = db.prepare(`
      INSERT INTO reference_revisions (
        id, referenceId, title, content, chapterNumber, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const ref of references) {
      const createdAt = ref.createdAt || now;
      const updatedAt = ref.updatedAt || now;
      const createdInChapterNumber = (ref as { createdInChapterNumber?: number | null }).createdInChapterNumber ?? null;
      const updatedInChapterNumber = (ref as { updatedInChapterNumber?: number | null }).updatedInChapterNumber ?? null;

      upsertRef.run(
        ref.id,
        novel.id,
        ref.title,
        ref.content,
        ref.tokenCount || null,
        createdAt,
        updatedAt,
        createdInChapterNumber,
        updatedInChapterNumber,
      );

      // Record a revision when newly created or updated this save
      const revisionId = nanoid();
      insertRevision.run(
        revisionId,
        ref.id,
        ref.title,
        ref.content,
        updatedInChapterNumber ?? createdInChapterNumber,
        now,
      );
    }

    novel.slug = normalizedSlug;
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

export async function clearNewChaptersFlag(id: string): Promise<void> {
  const db = getDb();
  db.prepare(`UPDATE novels SET hasNewChapters = 0 WHERE id = ?`).run(id);
}

// Clear cache (no longer needed with SQLite)
export function clearCache(): void {
  // No-op as we don't use caching with SQLite
}

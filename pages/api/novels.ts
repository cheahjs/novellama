import type { NextApiRequest, NextApiResponse } from 'next';
import { Novel } from '@/types';
import {
  readNovels,
  getNovelById,
  saveNovel,
  deleteNovel,
} from '@/utils/fileStorage';
import { nanoid } from 'nanoid';
import slugify from 'slugify';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    switch (req.method) {
      case 'GET': {
        // Get all novels or a specific novel
        if (req.query.id) {
          const chapterRange =
            req.query.chapterStart && req.query.chapterEnd
              ? {
                  start: parseInt(req.query.chapterStart as string),
                  end: parseInt(req.query.chapterEnd as string),
                }
              : undefined;

          const novel = await getNovelById(
            req.query.id as string,
            chapterRange,
          );
          if (!novel) {
            return res.status(404).json({ message: 'Novel not found' });
          }
          return res.status(200).json(novel);
        }
        const novels = await readNovels();
        return res.status(200).json(novels);
      }

      case 'POST': {
        // Create a new novel
        const body = req.body;
        const slugCandidate = body.slug
          ? slugify(body.slug, {
              lower: true,
              strict: true,
              trim: true,
            })
          : null;
        const fallbackSlug = slugify(body.title, {
          lower: true,
          strict: true,
          trim: true,
        });
        const normalizedSlug = slugCandidate && slugCandidate.length > 0
          ? slugCandidate
          : fallbackSlug && fallbackSlug.length > 0
            ? fallbackSlug
            : null;

        const novel: Novel = {
          id: nanoid(),
          slug: normalizedSlug,
          title: body.title,
          sourceLanguage: body.sourceLanguage,
          targetLanguage: body.targetLanguage,
          sourceUrl: body.sourceUrl || '',
          systemPrompt: body.systemPrompt || '',
          references: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          chapterCount: 0,
          readingChapterNumber: body.readingChapterNumber ?? null,
          translationTemplate: body.translationTemplate || null,
          translationModel: body.translationModel || null,
          qualityCheckModel: body.qualityCheckModel || null,
          translationToolCallsEnable: body.translationToolCallsEnable ?? null,
          maxTokens: body.maxTokens ?? null,
          maxTranslationOutputTokens: body.maxTranslationOutputTokens ?? null,
          maxQualityCheckOutputTokens: body.maxQualityCheckOutputTokens ?? null,
          sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : Date.now(),
        };
        try {
          await saveNovel(novel);
          return res.status(201).json(novel);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create novel';
          if (typeof message === 'string' && message.includes('Slug')) {
            return res.status(409).json({ message });
          }
          throw error;
        }
      }

      case 'PUT': {
        // Update a novel
        const { id } = req.query;
        const existingNovel = await getNovelById(id as string);
        if (!existingNovel) {
          return res.status(404).json({ message: 'Novel not found' });
        }

        const slugCandidate =
          typeof req.body.slug === 'string'
            ? slugify(req.body.slug, {
                lower: true,
                strict: true,
                trim: true,
              })
            : existingNovel.slug;
        const updatedSlug = slugCandidate && slugCandidate.length > 0 ? slugCandidate : null;

        const updatedNovel = {
          ...existingNovel,
          ...req.body,
          slug: updatedSlug,
          sortOrder:
            typeof req.body.sortOrder === 'number'
              ? req.body.sortOrder
              : existingNovel.sortOrder,
          updatedAt: Date.now(),
        };
        try {
          await saveNovel(updatedNovel);
          return res.status(200).json(updatedNovel);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update novel';
          if (typeof message === 'string' && message.includes('Slug')) {
            return res.status(409).json({ message });
          }
          throw error;
        }
      }

      case 'DELETE':
        // Delete a novel
        if (!req.query.id || typeof req.query.id !== 'string') {
          return res.status(400).json({ message: 'Invalid novel ID' });
        }

        const novelToDelete = await getNovelById(req.query.id);
        if (!novelToDelete) {
          return res.status(404).json({ message: 'Novel not found' });
        }

        await deleteNovel(novelToDelete.id);
        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

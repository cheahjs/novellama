import type { NextApiRequest, NextApiResponse } from 'next';
import { Novel } from '@/types';
import {
  readNovels,
  getNovelById,
  saveNovel,
  deleteNovel,
} from '@/utils/fileStorage';
import { nanoid } from 'nanoid';

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
      case 'GET':
        // Get all novels or a specific novel
        if (req.query.id) {
          const novel = await getNovelById(req.query.id as string);
          if (!novel) {
            return res.status(404).json({ message: 'Novel not found' });
          }
          return res.status(200).json(novel);
        }
        const novels = await readNovels();
        return res.status(200).json(novels);

      case 'POST':
        // Create a new novel
        const body = req.body;
        const novel: Novel = {
          id: nanoid(),
          title: body.title,
          sourceLanguage: body.sourceLanguage,
          targetLanguage: body.targetLanguage,
          sourceUrl: body.sourceUrl || '',
          systemPrompt: body.systemPrompt || '',
          references: [],
          chapters: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveNovel(novel);
        return res.status(201).json(novel);

      case 'PUT':
        // Update a novel
        const { id } = req.query;
        const existingNovel = await getNovelById(id as string);
        if (!existingNovel) {
          return res.status(404).json({ message: 'Novel not found' });
        }

        const updatedNovel = {
          ...existingNovel,
          ...req.body,
          updatedAt: Date.now(),
        };
        await saveNovel(updatedNovel);
        return res.status(200).json(updatedNovel);

      case 'DELETE':
        // Delete a novel
        await deleteNovel(req.query.id as string);
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

import type { NextApiRequest, NextApiResponse } from 'next';
import { updateNovelProgress } from '@/utils/fileStorage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid novel ID' });
  }

  const { readingChapterNumber } = req.body as {
    readingChapterNumber?: number | null;
  };

  if (
    readingChapterNumber !== null &&
    readingChapterNumber !== undefined &&
    (!Number.isFinite(readingChapterNumber) ||
      readingChapterNumber < 0 ||
      !Number.isInteger(readingChapterNumber))
  ) {
    return res.status(400).json({
      message: 'readingChapterNumber must be a non-negative integer or null',
    });
  }

  try {
    const updatedNovel = await updateNovelProgress(
      id,
      readingChapterNumber ?? null,
    );

    if (!updatedNovel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    return res.status(200).json(updatedNovel);
  } catch (error) {
    console.error('Failed to update reading progress:', error);
    return res.status(500).json({ message: 'Failed to update reading progress' });
  }
}


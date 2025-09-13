import { NextApiRequest, NextApiResponse } from 'next';
import { deleteChapterRevision } from '@/utils/chapterStorage';
import { getNovelById } from '@/utils/fileStorage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id, number, revisionId } = req.query;
  const novelId = id as string;
  const chapterNumber = parseInt(number as string);

  if (!novelId || isNaN(chapterNumber) || typeof revisionId !== 'string') {
    return res
      .status(400)
      .json({ message: 'Invalid novel ID, chapter number, or revision ID' });
  }

  try {
    const novel = await getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    switch (req.method) {
      case 'DELETE': {
        await deleteChapterRevision(novelId, chapterNumber, revisionId);
        return res.status(204).end();
      }
      default:
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error (delete revision):', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}



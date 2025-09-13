import { NextApiRequest, NextApiResponse } from 'next';
import { getChapterRevisions } from '@/utils/chapterStorage';
import { getNovelById } from '@/utils/fileStorage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id, number } = req.query;
  const novelId = id as string;
  const chapterNumber = parseInt(number as string);

  if (!novelId || isNaN(chapterNumber)) {
    return res
      .status(400)
      .json({ message: 'Invalid novel ID or chapter number' });
  }

  try {
    const novel = await getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    switch (req.method) {
      case 'GET': {
        const revisions = await getChapterRevisions(novelId, chapterNumber);
        return res.status(200).json(revisions);
      }
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error (revisions):', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}



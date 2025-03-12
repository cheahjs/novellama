import { NextApiRequest, NextApiResponse } from 'next';
import { getChapterMetadata } from '@/utils/chapterStorage';
import { getNovelById } from '@/utils/fileStorage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const novelId = id as string;

  if (!novelId) {
    return res.status(400).json({ message: 'Invalid novel ID' });
  }

  try {
    const novel = await getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    if (req.method === 'GET') {
      const chapterMetadata = await getChapterMetadata(novelId);
      return res.status(200).json(chapterMetadata);
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

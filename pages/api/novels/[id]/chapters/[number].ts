import { NextApiRequest, NextApiResponse } from 'next';
import { saveChapter, getChapter, deleteChapter } from '@/utils/chapterStorage';
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
      case 'GET':
        const chapter = await getChapter(novelId, chapterNumber);
        if (!chapter) {
          return res.status(404).json({ message: 'Chapter not found' });
        }
        return res.status(200).json(chapter);

      case 'PUT':
        await saveChapter(novelId, { ...req.body, number: chapterNumber });
        return res
          .status(200)
          .json({ message: 'Chapter updated successfully' });

      case 'DELETE':
        await deleteChapter(novelId, chapterNumber);
        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

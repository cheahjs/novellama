import { NextApiRequest, NextApiResponse } from 'next';
import { saveChapter } from '@/utils/chapterStorage';
import { getNovelById, saveNovel } from '@/utils/fileStorage';

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

    switch (req.method) {
      case 'POST':
        const chapter = req.body;
        await saveChapter(novelId, chapter);

        // Update novel's chapter count
        await saveNovel({
          ...novel,
          chapterCount: Math.max(novel.chapterCount || 0, chapter.number),
        });

        return res
          .status(201)
          .json({ message: 'Chapter created successfully' });

      default:
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

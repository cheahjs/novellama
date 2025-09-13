import { NextApiRequest, NextApiResponse } from 'next';
import { getNovelById } from '@/utils/fileStorage';
import { getChapters } from '@/utils/chapterStorage';

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
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Fetch novel for metadata and chapterCount
    const novel = await getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    const totalChapters = novel.chapterCount || 0;
    if (totalChapters === 0) {
      // Return an empty file with a header
      const emptyText = `# Novel: ${novel.title}\n` +
        `Source: ${novel.sourceLanguage}  Target: ${novel.targetLanguage}\n` +
        `Chapters: 0\n`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const safeTitle = novel.title.replace(/[^a-z0-9_-]+/gi, '_');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}_chapters.txt"`,
      );
      return res.status(200).send(emptyText);
    }

    // Optionally support range export via query params
    const start = req.query.start ? parseInt(req.query.start as string) : 1;
    const end = req.query.end
      ? parseInt(req.query.end as string)
      : totalChapters;

    // Clamp range
    const startNumber = Math.max(1, isNaN(start) ? 1 : start);
    const endNumber = Math.min(
      totalChapters,
      isNaN(end) ? totalChapters : end,
    );

    const chapters = await getChapters(novelId, startNumber, endNumber);

    // Build plain text export formatted for easy editing
    let exportText = '';
    exportText += `# Novel: ${novel.title}\n`;
    exportText += `Source: ${novel.sourceLanguage}  Target: ${novel.targetLanguage}\n`;
    exportText += `Chapters: ${chapters.length}\n`;
    exportText += `\n`;

    for (const chapter of chapters) {
      const title = chapter.title || `Chapter ${chapter.number}`;
      exportText += `## Chapter ${chapter.number}: ${title}\n`;
      exportText += `### Source\n`;
      // Ensure newlines are preserved as-is
      exportText += `${chapter.sourceContent}\n`;
      exportText += `\n`;
      exportText += `### Translation\n`;
      exportText += `${chapter.translatedContent}\n`;
      exportText += `\n`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const safeTitle = novel.title.replace(/[^a-z0-9_-]+/gi, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_chapters_${startNumber}-${endNumber}.txt"`,
    );
    return res.status(200).send(exportText);
  } catch (error) {
    console.error('Export API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}



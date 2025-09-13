import { NextApiRequest, NextApiResponse } from 'next';
import { saveChapter, deleteNovelChapters } from '@/utils/chapterStorage';
import { getNovelById } from '@/utils/fileStorage';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

function parseChaptersFromText(text: string): Array<{
  number: number;
  title: string;
  sourceContent: string;
  translatedContent: string;
}> {
  const lines = text.split(/\r?\n/);
  const chapters: Array<{
    number: number;
    title: string;
    sourceContent: string;
    translatedContent: string;
  }> = [];

  let i = 0;

  const chapterHeaderRegex = /^##\s*Chapter\s+(\d+)(?::\s*(.*))?$/i;
  const sectionSourceRegex = /^###\s*Source\s*$/i;
  const sectionTranslationRegex = /^###\s*Translation\s*$/i;

  while (i < lines.length) {
    const line = lines[i];
    const chapterMatch = line.match(chapterHeaderRegex);
    if (!chapterMatch) {
      i += 1;
      continue;
    }

    const chapterNumber = parseInt(chapterMatch[1], 10);
    const chapterTitle = (chapterMatch[2] || `Chapter ${chapterNumber}`).trim();
    i += 1;

    // Find Source section
    while (i < lines.length && !sectionSourceRegex.test(lines[i]) && !chapterHeaderRegex.test(lines[i])) {
      i += 1;
    }

    if (i >= lines.length || !sectionSourceRegex.test(lines[i])) {
      // No Source section found, skip this chapter block
      continue;
    }

    // Collect source content
    i += 1; // move past '### Source'
    const sourceStart = i;
    while (i < lines.length && !sectionTranslationRegex.test(lines[i]) && !chapterHeaderRegex.test(lines[i])) {
      i += 1;
    }
    const sourceEnd = i;
    const sourceContent = lines.slice(sourceStart, sourceEnd).join('\n').replace(/\s+$/, '');

    // Find Translation section (required)
    if (i < lines.length && sectionTranslationRegex.test(lines[i])) {
      i += 1; // move past '### Translation'
    } else {
      // No translation section, treat as empty
      chapters.push({
        number: chapterNumber,
        title: chapterTitle,
        sourceContent,
        translatedContent: '',
      });
      continue;
    }

    const translationStart = i;
    while (i < lines.length && !chapterHeaderRegex.test(lines[i])) {
      i += 1;
    }
    const translationEnd = i;
    const translatedContent = lines
      .slice(translationStart, translationEnd)
      .join('\n')
      .replace(/\s+$/, '');

    chapters.push({
      number: chapterNumber,
      title: chapterTitle,
      sourceContent,
      translatedContent,
    });
  }

  return chapters;
}

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
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const novel = await getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    const mode = (req.query.mode as string) === 'replace' ? 'replace' : 'merge';

    let rawBody: string | undefined;
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (typeof req.body === 'object' && req.body !== null) {
      const maybeContent = (req.body as Record<string, unknown>).content;
      if (typeof maybeContent === 'string') {
        rawBody = maybeContent;
      }
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = (req.body as Buffer).toString('utf8');
    }

    if (!rawBody) {
      return res.status(400).json({ message: 'Missing import content' });
    }

    const chapters = parseChaptersFromText(rawBody);

    if (chapters.length === 0) {
      return res.status(400).json({ message: 'No chapters found in content' });
    }

    if (mode === 'replace') {
      await deleteNovelChapters(novelId);
    }

    let minNumber = Number.POSITIVE_INFINITY;
    let maxNumber = 0;

    for (const ch of chapters) {
      minNumber = Math.min(minNumber, ch.number);
      maxNumber = Math.max(maxNumber, ch.number);
      await saveChapter(novelId, {
        id: '',
        number: ch.number,
        title: ch.title || `Chapter ${ch.number}`,
        sourceContent: ch.sourceContent,
        translatedContent: ch.translatedContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return res.status(200).json({
      message: 'Chapters imported successfully',
      imported: chapters.length,
      mode,
      range: { start: isFinite(minNumber) ? minNumber : null, end: maxNumber || null },
    });
  } catch (error) {
    console.error('Import API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}



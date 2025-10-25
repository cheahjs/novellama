import type { NextApiRequest, NextApiResponse } from 'next';
import { getNovelById, saveNovel } from '@/utils/fileStorage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const updates = req.body;

  if (!Array.isArray(updates)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  try {
    const novelsToUpdate = [];

    for (const update of updates) {
      if (!update?.id || typeof update.sortOrder !== 'number') {
        return res.status(400).json({ message: 'Invalid update object' });
      }

      const novel = await getNovelById(update.id);
      if (!novel) {
        return res.status(404).json({ message: `Novel ${update.id} not found` });
      }

      novelsToUpdate.push({ ...novel, sortOrder: update.sortOrder });
    }

    for (const novel of novelsToUpdate) {
      await saveNovel(novel);
    }

    return res.status(200).json({ message: 'Sort order updated successfully' });
  } catch (error) {
    console.error('Failed to update sort order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

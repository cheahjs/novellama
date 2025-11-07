import { Novel, NovelWithChapters, TranslationChapter, ChapterRevision, NovelSortUpdate } from '@/types';
import axios from 'axios';

export const saveNovel = async (
  novel: Novel | NovelWithChapters,
): Promise<void> => {
  try {
    const payload = {
      ...novel,
      translationToolCallsEnable:
        typeof novel.translationToolCallsEnable === 'boolean' || novel.translationToolCallsEnable === null
          ? novel.translationToolCallsEnable
          : null,
    };

    if (novel.id && (await getNovel(novel.id))) {
      // Update existing novel
      await axios.put(`/api/novels?id=${novel.id}`, payload);
    } else {
      // Create new novel
      await axios.post('/api/novels', payload);
    }
  } catch (error) {
    console.error('Failed to save novel:', error);
    throw error;
  }
};

export const getNovel = async (
  idOrSlug: string,
  chapterRange?: { start: number; end: number },
  req?: { headers: { host?: string } },
): Promise<NovelWithChapters | null> => {
  try {
    const params = new URLSearchParams();
    params.append('id', idOrSlug);
    if (chapterRange) {
      params.append('chapterStart', chapterRange.start.toString());
      params.append('chapterEnd', chapterRange.end.toString());
    }

    // Use absolute URL when running on server side
    const isServer = typeof window === 'undefined';
    let url = '/api/novels';

    if (isServer && req?.headers?.host) {
      const protocol =
        process.env.NODE_ENV === 'development' ? 'http' : 'https';
      url = `${protocol}://${req.headers.host}/api/novels`;
    }

    const response = await axios.get(`${url}?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get novel:', error);
    return null;
  }
};

export const getNovels = async (): Promise<Novel[]> => {
  try {
    const response = await axios.get('/api/novels');
    return response.data;
  } catch (error) {
    console.error('Failed to get novels:', error);
    return [];
  }
};

export const deleteNovel = async (id: string): Promise<void> => {
  try {
    await axios.delete(`/api/novels?id=${id}`);
  } catch (error) {
    console.error('Failed to delete novel:', error);
    throw error;
  }
};

export const addChapterToNovel = async (
  novelId: string,
  chapter: TranslationChapter,
): Promise<void> => {
  try {
    await axios.post(`/api/novels/${novelId}/chapters`, chapter);
  } catch (error) {
    console.error('Failed to add chapter to novel:', error);
    throw error;
  }
};

export const updateChapter = async (
  novelId: string,
  chapter: TranslationChapter,
): Promise<void> => {
  try {
    await axios.put(
      `/api/novels/${novelId}/chapters/${chapter.number}`,
      chapter,
    );
  } catch (error) {
    console.error('Failed to update chapter:', error);
    throw error;
  }
};

export const deleteChapter = async (
  novelId: string,
  chapterNumber: number,
): Promise<void> => {
  try {
    await axios.delete(`/api/novels/${novelId}/chapters/${chapterNumber}`);
  } catch (error) {
    console.error('Failed to delete chapter:', error);
    throw error;
  }
};

export const getChapterTOC = async (
  novelId: string,
): Promise<Array<{ number: number; title: string }>> => {
  try {
    const response = await axios.get(`/api/novels/${novelId}/chapters/toc`);
    return response.data;
  } catch (error) {
    console.error('Failed to get chapter TOC:', error);
    return [];
  }
};

export const exportChapters = async (
  novelId: string,
  range?: { start?: number; end?: number },
): Promise<Blob> => {
  const params = new URLSearchParams();
  if (range?.start) params.append('start', String(range.start));
  if (range?.end) params.append('end', String(range.end));

  const url = `/api/novels/${novelId}/chapters/export${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  const response = await axios.get(url, { responseType: 'blob' });
  return response.data as Blob;
};

export const importChapters = async (
  novelId: string,
  content: string,
  mode: 'merge' | 'replace' = 'merge',
): Promise<{ imported: number; mode: string; range: { start: number | null; end: number | null } }> => {
  const params = new URLSearchParams({ mode });
  const response = await axios.post(
    `/api/novels/${novelId}/chapters/import?${params.toString()}`,
    { content },
    { headers: { 'Content-Type': 'application/json' } },
  );
  return response.data;
};

export const updateNovelOrder = async (novels: NovelSortUpdate[]): Promise<void> => {
  try {
    await axios.put('/api/novels/order', novels);
  } catch (error) {
    console.error('Failed to update novel order:', error);
    throw error;
  }
};

export const getChapterRevisions = async (
  novelId: string,
  chapterNumber: number,
): Promise<ChapterRevision[]> => {
  try {
    const response = await axios.get(
      `/api/novels/${novelId}/chapters/${chapterNumber}/revisions`,
    );
    return response.data as ChapterRevision[];
  } catch (error) {
    console.error('Failed to get chapter revisions:', error);
    return [];
  }
};

export const deleteChapterRevision = async (
  novelId: string,
  chapterNumber: number,
  revisionId: string,
): Promise<void> => {
  try {
    await axios.delete(
      `/api/novels/${novelId}/chapters/${chapterNumber}/revisions/${revisionId}`,
    );
  } catch (error) {
    console.error('Failed to delete chapter revision:', error);
    throw error;
  }
};

export const updateReadingProgress = async (
  novelId: string,
  readingChapterNumber: number | null,
): Promise<Novel> => {
  try {
    const response = await axios.put(`/api/novels/${novelId}/progress`, {
      readingChapterNumber,
    });
    return response.data as Novel;
  } catch (error) {
    console.error('Failed to update reading progress:', error);
    throw error;
  }
};

import { Novel, NovelWithChapters, TranslationChapter } from '@/types';
import axios from 'axios';

export const saveNovel = async (
  novel: Novel | NovelWithChapters,
): Promise<void> => {
  try {
    if (novel.id && (await getNovel(novel.id))) {
      // Update existing novel
      await axios.put(`/api/novels?id=${novel.id}`, novel);
    } else {
      // Create new novel
      await axios.post('/api/novels', novel);
    }
  } catch (error) {
    console.error('Failed to save novel:', error);
    throw error;
  }
};

export const getNovel = async (
  id: string,
  chapterRange?: { start: number; end: number },
): Promise<NovelWithChapters | null> => {
  try {
    const params = new URLSearchParams({ id });
    if (chapterRange) {
      params.append('chapterStart', chapterRange.start.toString());
      params.append('chapterEnd', chapterRange.end.toString());
    }
    const response = await axios.get(`/api/novels?${params.toString()}`);
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

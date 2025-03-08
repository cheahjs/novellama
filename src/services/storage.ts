import { Novel, TranslationChunk } from '@/types';
import axios from 'axios';

export const saveNovel = async (novel: Novel): Promise<void> => {
  try {
    if (novel.id && await getNovel(novel.id)) {
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

export const getNovels = async (): Promise<Novel[]> => {
  try {
    const response = await axios.get('/api/novels');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch novels:', error);
    return [];
  }
};

export const getNovel = async (id: string): Promise<Novel | null> => {
  try {
    const response = await axios.get(`/api/novels?id=${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error('Failed to fetch novel:', error);
    return null;
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

export const addChunkToNovel = async (novelId: string, chunk: TranslationChunk): Promise<void> => {
  try {
    const novel = await getNovel(novelId);
    if (novel) {
      novel.chunks.push(chunk);
      novel.updatedAt = Date.now();
      await saveNovel(novel);
    }
  } catch (error) {
    console.error('Failed to add chunk to novel:', error);
    throw error;
  }
};

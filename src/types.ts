export interface Novel {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceUrl?: string;
  chapterCount: number;
  createdAt: number;
  updatedAt: number;
  references: Reference[];
}

export interface NovelWithChapters extends Novel {
  chapters: TranslationChapter[];
}

export interface TranslationChapter {
  id: string;
  number: number;
  title: string;
  sourceContent: string;
  translatedContent: string;
  createdAt: number;
  updatedAt: number;
  qualityCheck?: {
    score: number;
    feedback: string;
    isGoodQuality: boolean;
  };
}

export interface Reference {
  id: string;
  novelId: string;
  title: string;
  content: string;
  tokenCount?: number;
  createdAt: number;
  updatedAt: number;
}

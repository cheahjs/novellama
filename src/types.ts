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

export interface TranslationChapter {
  id: string;
  title: string;
  sourceContent: string;
  translatedContent: string;
  number: number;
  createdAt: number;
  updatedAt: number;
  qualityCheck?: QualityCheckResponse;
}

export interface Reference {
  id: string;
  title: string;
  content: string;
  tokenCount?: number; // Optional for backward compatibility
}

export interface Novel {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt: string;
  sourceUrl: string; // URL to the novel on syosetu.com
  references: Reference[];
  chapterCount: number; // Track total number of chapters
  createdAt: number;
  updatedAt: number;
  translationTemplate?: string;
}

export interface NovelWithChapters extends Novel {
  chapters: TranslationChapter[];
}

export interface TranslationRequest {
  sourceLanguage: string;
  targetLanguage: string;
  sourceContent: string;
  previousChapters?: TranslationChapter[];
  systemPrompt: string;
  references: Reference[];
  translationTemplate?: string;
  previousTranslation?: string;
  qualityFeedback?: string;
  useImprovementFeedback?: boolean;
}

export interface TranslationResponse {
  translatedContent: string;
  tokenUsage: {
    native_prompt: number;
    native_completion: number;
    system: number;
    task: number;
    translation: number;
  };
  qualityCheck?: QualityCheckResponse;
}

export interface QualityCheckResponse {
  isGoodQuality: boolean;
  score: number;
  feedback: string;
}

export interface AppearanceSettings {
  fontSize?: number; // e.g., 16
  fontFamily?: string; // e.g., 'Arial, sans-serif'
  margin?: number; // e.g., 4 (representing p-4 or similar)
}

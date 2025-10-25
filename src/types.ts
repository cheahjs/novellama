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
  createdInChapterNumber?: number | null;
  updatedInChapterNumber?: number | null;
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
  novelId: string;
  title: string;
  content: string;
  tokenCount?: number; // Optional for backward compatibility
  createdAt: number;
  updatedAt: number;
  createdInChapterNumber?: number | null;
  updatedInChapterNumber?: number | null;
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
  sortOrder: number;
  translationTemplate?: string;
  // Optional per-novel model configuration (enabled via env flag)
  translationModel?: string | null;
  qualityCheckModel?: string | null;
  // Optional per-novel toolcalls toggle
  translationToolCallsEnable?: boolean | null;
  // Token limits
  maxTokens?: number | null; // Context truncation token limit
  maxTranslationOutputTokens?: number | null;
  maxQualityCheckOutputTokens?: number | null;
}

export interface NovelSortUpdate {
  id: string;
  sortOrder: number;
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
  toolCalls?: ReferenceOp[];
}

export interface QualityCheckResponse {
  isGoodQuality: boolean;
  score: number;
  feedback: string;
}

// A persisted snapshot of a chapter at a point in time
export interface ChapterRevision {
  id: string;
  chapterId: string;
  title: string;
  sourceContent: string;
  translatedContent: string;
  createdAt: number;
  qualityCheck?: QualityCheckResponse;
}

export interface AppearanceSettings {
  fontSize?: number; // e.g., 16
  fontFamily?: string; // e.g., 'Arial, sans-serif'
  margin?: number; // e.g., 4 (representing p-4 or similar)
}

// Reference tool-call operations returned by the model
export type ReferenceOpType =
  | 'reference.add'
  | 'reference.update';

export interface ReferenceOp {
  type: ReferenceOpType;
  id?: string; // for update/delete when known
  title?: string; // fallback key if id is unknown
  content?: string; // new/updated content
}

export interface ReferenceRevision {
  id: string;
  referenceId: string;
  title: string;
  content: string;
  chapterNumber: number | null;
  createdAt: number;
}

export interface TranslationChapter {
  id: string;
  title: string;
  sourceContent: string;
  translatedContent: string;
  number: number;
  createdAt: number;
  updatedAt: number;
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
  chapters: TranslationChapter[];
  createdAt: number;
  updatedAt: number;
}

export interface TranslationRequest {
  sourceLanguage: string;
  targetLanguage: string;
  sourceContent: string;
  previousChapters?: TranslationChapter[];
  systemPrompt: string;
  references: Reference[];
}

export interface TranslationResponse {
  translatedContent: string;
  tokenUsage?: {
    native_prompt: number;
    native_completion: number;
    system: number;
    task: number;
    translation: number;
  };
}

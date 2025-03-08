export interface TranslationChunk {
  id: string;
  title: string;
  sourceContent: string;
  translatedContent: string;
  timestamp: number;
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
  chunks: TranslationChunk[];
  createdAt: number;
  updatedAt: number;
}

export interface TranslationRequest {
  sourceContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt: string;
  references: Reference[];
  previousChunks?: TranslationChunk[];
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

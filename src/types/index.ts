export interface TranslationChunk {
  id: string;
  sourceContent: string;
  translatedContent: string;
  timestamp: number;
}

export interface Novel {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt: string;
  references: string[];
  chunks: TranslationChunk[];
  createdAt: number;
  updatedAt: number;
}

export interface TranslationRequest {
  sourceContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt: string;
  references: string[];
  previousChunks?: TranslationChunk[];
}

export interface TranslationResponse {
  translatedContent: string;
}

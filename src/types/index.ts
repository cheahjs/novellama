export interface TranslationChunk {
  id: string;
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
    total: number;
    references: number;
    context: number;
    input: number;
    output: number;
  };
}

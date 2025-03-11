import axios from "axios";
import { QualityCheckResponse, TranslationRequest, TranslationResponse } from "@/types";
import { truncateContext } from "@/utils/tokenizer";

export const translateContent = async (
  request: TranslationRequest
): Promise<TranslationResponse> => {
  try {
    // Format references with titles
    const referencesText =
      request.references.length > 0
        ? "Here are references to use to assist in translation. Use them to help with the translation, but don't mention them in the translation:\n" +
          request.references
            .map(
              (ref) =>
                `<ref src="${ref.title}">\n${ref.content}\n</ref src="${ref.title}">`
            )
            .join("\n\n")
        : "";

    let context: { role: string; content: string }[] = [];
    if (request.previousChapters && request.previousChapters.length > 0) {
      // Format previous chunks as context
      context = request.previousChapters
        .map((chapter) => [
          {
            role: "user",
            content: `${chapter.sourceContent}`,
          },
          {
            role: "assistant",
            content: `${chapter.translatedContent}`,
          },
        ])
        .flat();
    }

    const translationTemplate = request.translationTemplate || 
      'Translate the following text from ${sourceLanguage} to ${targetLanguage}. Make sure to preserve and translate the header.\n\n${sourceContent}';

    const translationInstruction = translationTemplate
      .replace('${sourceLanguage}', request.sourceLanguage)
      .replace('${targetLanguage}', request.targetLanguage)
      .replace('${sourceContent}', request.sourceContent);

    // Create messages for the API call
    const messages = [
      {
        role: "system",
        content: `${request.systemPrompt}`,
      },
      {
        role: "user",
        content: `${referencesText}\n\nYou may be provided examples of previous translations. Use them to help with the translation.`,
      },
      ...context,
      {
        role: "user",
        content: translationInstruction,
      },
    ];

    // Truncate messages to respect token limits
    const { messages: truncatedMessages, tokenCounts } = await truncateContext(
      messages
    );
    console.log("Truncated messages", {
      tokenCounts,
      messages,
      truncatedMessages,
    });

    // Make API call to OpenAI-compatible endpoint
    const response = await axios.post("/api/translate", {
      messages: truncatedMessages,
    });

    const translatedContent = response.data.translation;

    // Perform quality check
    const qualityCheckResponse = await checkTranslationQuality({
      sourceContent: request.sourceContent,
      translatedContent,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    });

    return {
      translatedContent,
      tokenUsage: {
        native_prompt: response.data.tokenUsage.prompt_tokens,
        native_completion: response.data.tokenUsage.completion_tokens,
        system: tokenCounts.system,
        task: tokenCounts.task,
        translation: tokenCounts.translation,
      },
      qualityCheck: qualityCheckResponse,
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate content");
  }
};

export const checkTranslationQuality = async ({
  sourceContent,
  translatedContent,
  sourceLanguage,
  targetLanguage,
}: {
  sourceContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<QualityCheckResponse> => {
  try {
    const response = await axios.post('/api/quality-check', {
      sourceContent,
      translatedContent,
      sourceLanguage,
      targetLanguage,
    });
    
    return response.data;
  } catch (error) {
    console.error("Quality check error:", error);
    return {
      isGoodQuality: true, // Default to true to not block the flow
      score: 0,
      feedback: "Quality check failed. Please review manually.",
    };
  }
};

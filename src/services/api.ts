import axios from "axios";
import { TranslationRequest, TranslationResponse } from "@/types";
import { truncateContext } from "@/utils/tokenizer";
import { processReferences } from "@/utils/referenceUtils";
import { countTokens } from "@/utils/tokenizer";

export const translateContent = async (
  request: TranslationRequest
): Promise<TranslationResponse> => {
  try {
    // Process references to respect token limits
    const processedReferences = await processReferences(request.references);

    // Format references with titles
    const referencesText =
      processedReferences.length > 0
        ? "Here are references to use to assist in translation:\n" +
          processedReferences
            .map(
              (ref) =>
                `<ref src="${ref.title}">\n${ref.content}\n</ref src="${ref.title}">`
            )
            .join("\n\n")
        : "";

    let context: { role: string; content: string }[] = [];
    if (request.previousChunks && request.previousChunks.length > 0) {
      // Format previous chunks as context
      context = request.previousChunks
        .map((chunk) => [
          {
            role: "user",
            content: `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}:\n\n${chunk.sourceContent}`,
          },
          {
            role: "assistant",
            content: `${chunk.translatedContent}`,
          },
        ])
        .flat();
    }

    // Create messages for the API call
    const messages = [
      {
        role: "system",
        content: `${request.systemPrompt}\n\n${referencesText}`,
      },
      ...context,
      {
        role: "user",
        content: `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}:\n\n${request.sourceContent}`,
      },
    ];

    // Truncate messages to respect token limits
    const { messages: truncatedMessages, tokenCounts } = await truncateContext(
      messages
    );

    // Make API call to OpenAI-compatible endpoint
    const response = await axios.post("/api/translate", { messages });

    // Count output tokens
    const outputTokens = await countTokens(response.data.translation);

    // Calculate total token usage
    const totalTokens =
      referenceTokens + contextTokens + inputTokens + outputTokens;

    return {
      translatedContent: response.data.translation,
      tokenUsage: {
        total: totalTokens,
        references: referenceTokens,
        context: contextTokens,
        input: inputTokens,
        output: outputTokens,
      },
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate content");
  }
};

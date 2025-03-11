import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

interface QualityCheckRequest {
  sourceContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface QualityCheckResponse {
  isGoodQuality: boolean;
  score: number;
  feedback: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { sourceContent, translatedContent, sourceLanguage, targetLanguage } =
      req.body as QualityCheckRequest;
    const url = `${
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    }/chat/completions`;

    const systemPrompt = `You are a professional translator quality checker. 
You will be given a source text in ${sourceLanguage} and its translation in ${targetLanguage}.
Evaluate the translation quality focusing on accuracy, fluency, and completeness.`;

    const userPrompt = `Source text (${sourceLanguage}):
${sourceContent}

Translation (${targetLanguage}):
${translatedContent}

Please evaluate the quality of this translation. Consider:
1. Accuracy: Does it faithfully represent the original content?
2. Fluency: Is it natural in the target language?
3. Completeness: Was anything omitted or added inappropriately?

Rate the translation on a scale from 0 to 10 and provide brief feedback.

Return JSON in the format:
{
    "score": <number>,
    "feedback": "<string>",
    "isGoodQuality": <boolean>
}`;

    const apiResponse = await axios.post(
      url,
      {
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Parse the response
    const responseContent = JSON.parse(
      apiResponse.data.choices[0].message.content
    );
    const qualityCheck: QualityCheckResponse = {
      isGoodQuality: responseContent.score >= 7,
      score: responseContent.score,
      feedback: responseContent.feedback || responseContent.evaluation || "",
    };

    return res.status(200).json(qualityCheck);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error("API error:", error.response?.data || error.message);
      return res.status(500).json({
        message: "Error processing quality check",
        error: error.message,
      });
    }
    const message = error instanceof Error ? error.message : `${error}`;
    return res.status(500).json({
      message: "Error processing quality check",
      error: message,
    });
  }
}

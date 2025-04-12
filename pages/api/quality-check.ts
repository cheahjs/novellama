import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { QualityCheckResponse } from '@/types';
import { serverConfig } from '../../config';

interface QualityCheckRequest {
  sourceContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { sourceContent, translatedContent, sourceLanguage, targetLanguage } =
      req.body as QualityCheckRequest;

    // Try to get quality check, with one retry on JSON parse error
    const qualityCheck = await getQualityCheck(
      sourceContent,
      translatedContent,
      sourceLanguage,
      targetLanguage,
    );

    return res.status(200).json(qualityCheck);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API error:', error.response?.data || error.message);
      return res.status(500).json({
        message: 'Error processing quality check',
        error: error.message,
      });
    }
    const message = error instanceof Error ? error.message : `${error}`;
    console.error('Error processing quality check', {
      error,
      message,
    });
    return res.status(500).json({
      message: 'Error processing quality check',
      error: message,
    });
  }
}

async function getQualityCheck(
  sourceContent: string,
  translatedContent: string,
  sourceLanguage: string,
  targetLanguage: string,
  retryCount = 0,
): Promise<QualityCheckResponse> {
  const url = `${serverConfig.openaiBaseUrl}/chat/completions`;

  const systemPrompt = `You are a professional translator quality checker. 
You will be given a source text in ${sourceLanguage} and its translation in ${targetLanguage}.
Evaluate the translation quality focusing on accuracy, fluency, and completeness.
This is a quality check of a single chapter of a novel. Note that you may not have the context of the entire novel, so some terminology such as names and places may not be familiar.
This is of a webnovel, so an author may have comments at the start and end of the chapter, these are acceptable.

The source text will be provided in <source> tags, and the translation will be provided in <translation> tags.

Consider:
1. Accuracy: Does it faithfully represent the original content?
2. Fluency: Is it natural in the target language?
3. Completeness: Was anything omitted or added inappropriately? 
   - IMPORTANT: Compare the source and translation line by line, especially the first and last lines
   - Be aware that some sentences might be split differently due to language differences
4. Title: The title must be translated. If the title translation deviates from the source title (such as an irrelevant translation or incorrect numbering), this is a significant issue and should not score higher than 7.
5. Extraneous content: If there's extraneous content in the translation, this is a significant issue and should not score higher than 7. Extraneous content is content that is not part of the source content, for example if it appears that the contents of another chapter is included in the translation.
   - Author comments at the start and end of the chapter are acceptable and are not considered extraneous content.
   - The content may be separated by horizontal rules (---). These indicate the boundaries between preface, main content, and afterword sections. Ensure all sections are translated and maintain their relative positions.
6. The content inside of <translation> tags must only contain the translation, and not any other content such as feedback or the source content. If there is any other content, this is a significant issue and should not score higher than 7. Don't mention the translation tags in the feedback - the translator does not see the tags.
7. Meta-commentary: The translation should not contain any meta-commentary about the translation process, feedback incorporation, or translator notes. If it does, this is a significant issue and should not score higher than 7.
   - The author's comments in the preface and afterword (marked by horizontal rules) are acceptable and are not considered meta-commentary, and should be translated.
8. Is the text actually translated? If the translation is still in the source language, it should score 0.
9. If there are markdown code blocks using backticks in the translation, these are invalid and should not score higher than 7.

Before assigning a score below 8 for missing content:
- Double-check that you're not missing content due to different sentence structures between languages
- Verify that what appears to be missing isn't actually rephrased or combined with another sentence
- Check if the apparent missing content isn't actually present in a slightly different location

Rate the translation on a scale from 0 to 10 and provide brief feedback, where anything below 8 indicates that the translation is not of good quality and should be re-translated.

Return JSON in the format:
{
  "feedback": "<string>",
  "score": <number>,
}`;

  const userPrompt = `Source text (${sourceLanguage}):
<source>
${sourceContent}
</source>

Translation (${targetLanguage}):
<translation>
${translatedContent}
</translation>
`;

  try {
    const apiResponse = await axios.post(
      url,
      {
        model: serverConfig.qualityCheckModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: serverConfig.qualityCheckTemperature,
        max_tokens: serverConfig.maxQualityCheckOutputTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quality_check',
            schema: {
              type: 'object',
              properties: {
                feedback: { type: 'string' },
                score: { type: 'number' },
              },
              required: ['score', 'feedback'],
            },
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serverConfig.openaiApiKey}`,
        },
      },
    );

    console.log('quality check response', {
      response: apiResponse,
      content: apiResponse.data.choices[0].message.content,
      usage: apiResponse.data.usage,
    });

    try {
      // Parse the response
      const responseContent = JSON.parse(
        apiResponse.data.choices[0].message.content,
      );

      return {
        isGoodQuality: responseContent.score > 7,
        score: responseContent.score,
        feedback: responseContent.feedback || responseContent.evaluation || '',
      };
    } catch (parseError) {
      // If this is the first attempt and there's a JSON parsing error, retry once
      if (retryCount === 0) {
        console.warn(
          'JSON parse error, retrying quality check request',
          parseError,
        );
        return getQualityCheck(
          sourceContent,
          translatedContent,
          sourceLanguage,
          targetLanguage,
          1,
        );
      }

      // If we've already retried, throw the error
      throw new Error(`Failed to parse quality check response: ${parseError}`);
    }
  } catch (error) {
    // Rethrow any other errors
    throw error;
  }
}

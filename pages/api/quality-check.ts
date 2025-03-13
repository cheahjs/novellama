import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { QualityCheckResponse } from '@/types';

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
  const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;

  const systemPrompt = `You are a professional translator quality checker. 
You will be given a source text in ${sourceLanguage} and its translation in ${targetLanguage}.
Evaluate the translation quality focusing on accuracy, fluency, and completeness.

Consider:
1. Accuracy: Does it faithfully represent the original content?
2. Fluency: Is it natural in the target language?
3. Completeness: Was anything omitted or added inappropriately? The translation should be complete and not missing any important information or be truncated.
4. Title: The title must be translated. If the title translation deviates from the source title (such as an irrelevant translation or incorrect numbering), this is a significant issue and should not score higher than 7.
5. Extranous content: If there's extranous content in the translation, this is a significant issue and should not score higher than 7. Extranous content is content that is not part of the source content, for example if it appears that the contents of another chapter is included in the translation.
6. The content inside of <translation> tags must only contain the translation, and not any other content such as feedback or the source content. If there is any other content, this is a significant issue and should not score higher than 7. Don't mention the translation tags in the feedback - the translator does not see the tags.

Rate the translation on a scale from 0 to 10 and provide brief feedback, where anything below 8 indicates that the translation is not of good quality and should be re-translated.

Return JSON in the format:
{
    "score": <number>,
    "feedback": "<string>"
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
        model: process.env.QUALITY_CHECK_MODEL || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: parseFloat(process.env.QUALITY_CHECK_TEMPERATURE || '0.1'),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quality_check',
            schema: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                feedback: { type: 'string' },
              },
              required: ['score', 'feedback'],
            },
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

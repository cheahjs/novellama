import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function makeTranslationRequest(
  url: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  apiKey: string,
) {
  const response = await axios.post(
    url,
    {
      model,
      messages,
      temperature,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  return response;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
    const model = process.env.TRANSLATION_MODEL || 'gpt-4';
    const temperature = parseFloat(
      process.env.TRANSLATION_TEMPERATURE || '0.1',
    );
    const apiKey = process.env.OPENAI_API_KEY!;

    console.log(
      `Making translation request with ${messages.length} messages (model: ${model}, temperature: ${temperature})`,
    );

    // First attempt
    let apiResponse = await makeTranslationRequest(
      url,
      messages,
      model,
      temperature,
      apiKey,
    );

    // Check if we hit the length limit and retry once if needed
    if (apiResponse.data.choices[0].finish_reason === 'length') {
      console.log('Hit length limit, retrying with the same parameters...');
      apiResponse = await makeTranslationRequest(
        url,
        messages,
        model,
        temperature,
        apiKey,
      );
    }

    // Extract translation from the response
    const translation = apiResponse.data.choices[0].message.content;
    // Extract token usage from the response
    const tokenUsage = apiResponse.data.usage;
    console.log('response', {
      apiResponse,
      usage: tokenUsage,
    });

    return res.status(200).json({ translation, tokenUsage });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API error:', error.response?.data || error.message);
      return res.status(500).json({
        message: 'Error processing translation',
        error: error.message,
      });
    }
    const message = error instanceof Error ? error.message : `${error}`;
    return res.status(500).json({
      message: 'Error processing translation',
      error: message,
    });
  }
}

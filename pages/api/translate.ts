import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
    console.log("url", url);
    console.log("messages", messages);
    console.log({
      url,
      body: {
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: 0.1,
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    })

    const apiResponse = await axios.post(
      url,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: 0.1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Extract translation from the response
    const translation = apiResponse.data.choices[0].message.content;
    // Extract token usage from the response
    const tokenUsage = apiResponse.data.usage;
    console.log("response", {
      apiResponse,
    })
    
    return res.status(200).json({ translation, tokenUsage });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API error:', error.response?.data || error.message);
      return res.status(500).json({ 
        message: 'Error processing translation',
        error: error.message
      });
    }
    const message = error instanceof Error ? error.message : `${error}`;
    return res.status(500).json({ 
      message: 'Error processing translation',
      error: message
    });
  }
}

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

    // Replace with your actual OpenAI-compatible API endpoint
    const apiResponse = await axios.post(
      `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`,
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: 0.3,
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
    
    return res.status(200).json({ translation });
  } catch (error: any) {
    console.error('API error:', error.response?.data || error.message);
    return res.status(500).json({ 
      message: 'Error processing translation',
      error: error.message
    });
  }
}

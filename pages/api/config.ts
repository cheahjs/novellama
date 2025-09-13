import type { NextApiRequest, NextApiResponse } from 'next';

// Client configuration type
export interface ClientConfig {
  tokenizerModel: string;
  maxTokens: number;
  streamTranslations: boolean;
}

// Default client configuration
const clientConfig: ClientConfig = {
  tokenizerModel: process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o',
  maxTokens: Number(process.env.MAX_TOKENS || '16000'),
  streamTranslations:
    (process.env.TRANSLATION_USE_STREAMING || '').toLowerCase() === 'true' ||
    process.env.TRANSLATION_USE_STREAMING === '1',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    return res.status(200).json(clientConfig);
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 
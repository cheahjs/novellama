import type { NextApiRequest, NextApiResponse } from 'next';
import { serverConfig } from '../../config';

// Client configuration type
export interface ClientConfig {
  tokenizerModel: string;
  maxTokens: number;
  modelConfigEnable: boolean;
}

// Default client configuration
const clientConfig: ClientConfig = {
  tokenizerModel: process.env.TOKENIZER_MODEL || 'Xenova/gpt-4o',
  maxTokens: Number(process.env.MAX_TOKENS || '16000'),
  modelConfigEnable: serverConfig.modelConfigEnable,
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
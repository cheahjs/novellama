import { NextApiRequest, NextApiResponse } from 'next';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the webpage content
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return res.status(400).json({ error: 'Could not extract content from the webpage' });
    }

    return res.status(200).json({
      title: article.title,
      content: article.textContent,
      excerpt: article.excerpt,
    });
  } catch (error) {
    console.error('Error scraping webpage:', error);
    return res.status(500).json({ error: 'Failed to scrape webpage' });
  }
} 
import { NextApiRequest, NextApiResponse } from 'next';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, chapterNumber, type = 'general' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Construct chapter URL if chapter number is provided for syosetu
    const targetUrl =
      type === 'syosetu' && chapterNumber ? `${url}${chapterNumber}/` : url;

    // Fetch the webpage content
    const response = await axios.get(targetUrl);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    if (type === 'syosetu') {
      // Extract title and content specifically for syosetu.com
      const title = document
        .querySelector('.p-novel__title')
        ?.textContent?.trim();

      // Extract preface, main content, and afterword
      const preface = document
        .querySelector('.p-novel__text--preface')
        ?.textContent?.trim();
      const mainContent = document
        .querySelector(
          '.js-novel-text:not(.p-novel__text--preface):not(.p-novel__text--afterword)',
        )
        ?.textContent?.trim();
      const afterword = document
        .querySelector('.p-novel__text--afterword')
        ?.textContent?.trim();

      if (!title || !mainContent) {
        return res.status(400).json({
          error: 'Could not extract content from the syosetu webpage',
        });
      }

      // Format content with Markdown
      let formattedContent = '';
      if (preface) {
        formattedContent += `${preface}\n\n---\n\n`;
      }

      formattedContent += mainContent;

      if (afterword) {
        formattedContent += `\n\n---\n\n${afterword}`;
      }

      return res.status(200).json({
        title,
        content: formattedContent,
      });
    } else {
      // Use Readability for general webpage scraping
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return res
          .status(400)
          .json({ error: 'Could not extract content from the webpage' });
      }

      return res.status(200).json({
        title: article.title,
        content: article.textContent,
        excerpt: article.excerpt,
      });
    }
  } catch (error) {
    console.error('Error scraping webpage:', error);
    return res.status(500).json({ error: 'Failed to scrape webpage' });
  }
}

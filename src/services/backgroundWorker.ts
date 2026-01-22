import axios from 'axios';
import { JSDOM } from 'jsdom';
import { getDb } from '../utils/db';
import { readNovels } from '../utils/fileStorage';
import { serverConfig } from '../../config';

let isRunning = false;
let timer: NodeJS.Timeout | null = null;

export async function checkSyosetsuRecentChapters() {
  if (isRunning) return;
  isRunning = true;
  console.log('Starting Syosetsu recent chapters check...');

  try {
    const novels = await readNovels();
    for (const novel of novels) {
      if (!novel.sourceUrl.includes('syosetu.com')) continue;

      try {
        const urlObj = new URL(novel.sourceUrl);
        const host = urlObj.host;
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const novelCode = pathSegments.find(s => /^n[a-z0-9]{4,}$/.test(s));

        if (!novelCode) {
          console.warn(`[BackgroundWorker] Could not extract novel code from URL: ${novel.sourceUrl}`);
          continue;
        }

        console.log(`[BackgroundWorker] Checking novel: ${novel.title} (${novelCode})`);

        let maxChapter = 0;

        // Try to fetch the Novel Info page first as it contains the definitive total chapter count
        try {
          // Standard Syosetsu Novel Info URL structure
          const infoUrl = `https://${host}/novelview/infotop/ncode/${novelCode}/`;
          const infoResponse = await axios.get(infoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            }
          });
          const infoDom = new JSDOM(infoResponse.data);
          const infoDoc = infoDom.window.document;

          // Extract from .p-infotop-type__allep (e.g., "全757エピソード")
          const episodeText = infoDoc.querySelector('.p-infotop-type__allep')?.textContent || '';
          const match = episodeText.match(/全\s*(\d+)\s*エピソード/);
          if (match) {
            maxChapter = parseInt(match[1], 10);
          }
        } catch (infoErr) {
          console.warn(`[BackgroundWorker] Failed to fetch info page for ${novel.title}, falling back to index page:`, infoErr instanceof Error ? infoErr.message : infoErr);
        }

        // Fallback: If info page failed or didn't yield a result, check the main index page
        if (maxChapter === 0) {
          const response = await axios.get(novel.sourceUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            }
          });
          const dom = new JSDOM(response.data);
          const document = dom.window.document;

          // Check for pagination "Last" link (最後へ)
          const lastPageLink = Array.from(document.querySelectorAll('.c-pager__item--last, .nextprev a')).find(el => el.textContent?.includes('最後') || el.getAttribute('href')?.includes('?p='));
          
          if (lastPageLink) {
            const lastHref = lastPageLink.getAttribute('href');
            if (lastHref) {
              const lastUrl = new URL(lastHref, novel.sourceUrl).href;
              const lastResponse = await axios.get(lastUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                }
              });
              const lastDom = new JSDOM(lastResponse.data);
              const chapterLinks = Array.from(lastDom.window.document.querySelectorAll('a[href]'));
              for (const link of chapterLinks) {
                const href = link.getAttribute('href');
                if (href) {
                  const match = href.match(new RegExp(`/${novelCode}/([0-9]+)/?$`));
                  if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxChapter) maxChapter = num;
                  }
                }
              }
            }
          }

          // If still zero or as a general scan of the current page
          const chapterLinks = Array.from(document.querySelectorAll('a[href]'));
          for (const link of chapterLinks) {
            const href = link.getAttribute('href');
            if (href) {
              const match = href.match(new RegExp(`/${novelCode}/([0-9]+)/?$`));
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxChapter) maxChapter = num;
              }
            }
          }
        }

        console.log(`[BackgroundWorker] Found max chapter ${maxChapter} for "${novel.title}". Current chapters in DB: ${novel.chapterCount}`);

        if (maxChapter > (novel.chapterCount || 0)) {
          console.log(`[BackgroundWorker] NEW chapters found for "${novel.title}"! Setting hasNewChapters flag.`);
          const db = getDb();
          db.prepare('UPDATE novels SET hasNewChapters = 1 WHERE id = ?').run(novel.id);
        } else if (novel.hasNewChapters && maxChapter <= (novel.chapterCount || 0)) {
          const db = getDb();
          db.prepare('UPDATE novels SET hasNewChapters = 0 WHERE id = ?').run(novel.id);
        }
      } catch (err) {
        console.error(`[BackgroundWorker] Failed to check chapters for "${novel.title}":`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('Error in background worker:', err);
  } finally {
    isRunning = false;
    console.log('Finished Syosetsu recent chapters check.');
  }
}

export function startBackgroundWorker() {
  if (timer) return;

  const intervalMs = (serverConfig.novelCheckIntervalHours || 12) * 60 * 60 * 1000;
  console.log(`Initializing background worker with interval of ${serverConfig.novelCheckIntervalHours} hours (${intervalMs}ms)`);

  // Run once immediately
  checkSyosetsuRecentChapters();

  // Schedule periodic runs
  timer = setInterval(checkSyosetsuRecentChapters, intervalMs);
}

export function stopBackgroundWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

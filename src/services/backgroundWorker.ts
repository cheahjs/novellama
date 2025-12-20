import axios from 'axios';
import { JSDOM } from 'jsdom';
import { getDb } from '../utils/db';
import { saveNovel, readNovels } from '../utils/fileStorage';
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
        console.log(`[BackgroundWorker] Checking novel: ${novel.title} (${novel.sourceUrl})`);
        
        // Fetch the novel index page
        const response = await axios.get(novel.sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          }
        });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Path should look like /n1234xx/
        const urlObj = new URL(novel.sourceUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        // The first segment that starts with 'n' followed by at least 4 chars is usually the novel code
        const novelCode = pathSegments.find(s => /^n[a-z0-9]{4,}$/.test(s));

        if (!novelCode) {
          console.warn(`[BackgroundWorker] Could not extract novel code from URL: ${novel.sourceUrl}`);
          continue;
        }

        // Search for chapter links. Both in new layout (.p-eplist__subtitle) and old legacy layouts.
        const chapterLinks = Array.from(document.querySelectorAll('a[href]'));
        let maxChapter = 0;

        for (const link of chapterLinks) {
          const href = link.getAttribute('href');
          if (!href) continue;

          // Match patterns:
          // /n1234xx/1/
          // https://ncode.syosetu.com/n1234xx/1/
          // Novel codes are mixed case sometimes, but usually lowercase in URLs
          const match = href.match(new RegExp(`/${novelCode}/([0-9]+)/?$`));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxChapter) {
              maxChapter = num;
            }
          }
        }

        console.log(`[BackgroundWorker] Found max chapter ${maxChapter} for "${novel.title}". Current chapters in DB: ${novel.chapterCount}`);

        if (maxChapter > (novel.chapterCount || 0)) {
          console.log(`[BackgroundWorker] NEW chapters found for "${novel.title}"! Setting hasNewChapters flag.`);
          // Using raw DB update to avoid side-effects of saveNovel (like updating createdAt if it was somehow missing)
          const db = getDb();
          db.prepare('UPDATE novels SET hasNewChapters = 1 WHERE id = ?').run(novel.id);
        } else if (novel.hasNewChapters && maxChapter <= (novel.chapterCount || 0)) {
          // If it was marked new but now it's not (maybe user manually updated chapters), clear it.
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

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings, FiSliders } from 'react-icons/fi';
import { Novel, TranslationChapter, AppearanceSettings } from '@/types';
import {
  getNovel,
  saveNovel,
  addChapterToNovel,
  deleteChapter,
  updateChapter,
  getChapterTOC,
} from '@/services/storage';
import { checkTranslationQuality, translateContent } from '@/services/api';
import TranslationEditor from '@/components/translation/TranslationEditor';
import ChapterNavigation from '@/components/translation/ChapterNavigation';
import NovelSettings from '@/components/novel/NovelSettings';
import { toast, Toaster } from 'react-hot-toast';
import NProgress from 'nprogress';

interface TranslationResult {
  translatedContent: string;
  tokenUsage: {
    native_prompt: number;
    native_completion: number;
    system: number;
    task: number;
    translation: number;
  };
  qualityCheck?: {
    score: number;
    feedback: string;
    isGoodQuality: boolean;
  };
}

async function performTranslation({
  sourceContent,
  novelId,
  currentChapterId,
  useAutoRetry,
  previousTranslationData,
  toastId,
}: {
  sourceContent: string;
  novelId: string;
  currentChapterId?: string;
  useAutoRetry: boolean;
  previousTranslationData?: {
    previousTranslation?: string;
    qualityFeedback?: string;
    useImprovementFeedback?: boolean;
  };
  toastId?: string;
}): Promise<TranslationResult> {
  if (!useAutoRetry) {
    return translateContent({
      sourceContent,
      novelId,
      currentChapterId,
      ...previousTranslationData,
    });
  }

  let bestResult: TranslationResult | null = null;
  const maxAttempts = 5;
  let lastToastId: string | null = null;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (toastId) {
        lastToastId = toast.loading(
          `Translation attempt ${attempt + 1}/${maxAttempts}...`,
          {
            duration: Infinity,
          },
        );
      }

      const result = await translateContent({
        sourceContent,
        novelId,
        currentChapterId,
        ...(attempt === 0
          ? previousTranslationData
          : bestResult
            ? {
                previousTranslation: bestResult.translatedContent,
                qualityFeedback: bestResult.qualityCheck?.feedback || '',
                useImprovementFeedback: true,
              }
            : {}),
      });
      if (lastToastId) {
        toast.dismiss(lastToastId);
      }

      if (
        !bestResult ||
        (result.qualityCheck?.score || 0) >
          (bestResult.qualityCheck?.score || 0)
      ) {
        bestResult = result;
        if (toastId && bestResult.qualityCheck) {
          toast.loading(
            `New best translation found (Score: ${bestResult.qualityCheck.score})`,
            { duration: 10_000 },
          );
        }
      }

      if (result.qualityCheck?.isGoodQuality) {
        return result;
      }
    }
  } catch (error) {
    console.error('Translation error:', error);
    toast.error(`Translation failed: ${error}`);
  } finally {
    if (lastToastId) {
      toast.dismiss(lastToastId);
    }
  }

  return (
    bestResult ||
    (await translateContent({ sourceContent, novelId, currentChapterId }))
  );
}

async function saveChapter({
  novel,
  chapter,
  setLoadedChapters,
  setChapterMetadata,
  setNovel,
}: {
  novel: Novel;
  chapter: TranslationChapter;
  setLoadedChapters: (
    updater: (chapters: TranslationChapter[]) => TranslationChapter[],
  ) => void;
  setChapterMetadata: (
    updater: (
      metadata: Array<{ number: number; title: string }>,
    ) => Array<{ number: number; title: string }>,
  ) => void;
  setNovel: (novel: Novel | null) => void;
}) {
  const isNewChapter = !chapter.id.startsWith('chapter_');

  if (isNewChapter) {
    await addChapterToNovel(novel.id, chapter);
  } else {
    await updateChapter(novel.id, chapter);
  }

  // Update loaded chapters
  setLoadedChapters((prevChapters) => {
    const newChapters = [...prevChapters];
    const index = newChapters.findIndex((ch) => ch.number === chapter.number);
    if (index >= 0) {
      newChapters[index] = chapter;
    } else {
      newChapters.push(chapter);
    }
    return newChapters.sort((a, b) => a.number - b.number);
  });

  // Update metadata
  setChapterMetadata((prevMetadata) => {
    const newMetadata = [...prevMetadata];
    const index = newMetadata.findIndex((ch) => ch.number === chapter.number);
    if (index >= 0) {
      newMetadata[index] = { number: chapter.number, title: chapter.title };
    } else {
      newMetadata.push({ number: chapter.number, title: chapter.title });
    }
    return newMetadata.sort((a, b) => a.number - b.number);
  });

  // Reload novel
  const updatedNovel = await getNovel(novel.id);
  if (updatedNovel) {
    setNovel(updatedNovel);
  }
}

async function scrapeChapter(novelUrl: string, chapterNumber: number) {
  const response = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: novelUrl,
      chapterNumber,
      type: 'syosetu',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to scrape chapter ${chapterNumber}`);
  }

  const data = await response.json();
  if (!data.title || !data.content) {
    throw new Error(`No content found for chapter ${chapterNumber}`);
  }

  return { title: data.title, content: data.content };
}

const LOCAL_STORAGE_KEY = 'novelLamaAppearanceSettings';

// Utility to safely get settings from localStorage
const loadAppearanceSettings = (): AppearanceSettings => {
  try {
    const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedSettings) {
      return JSON.parse(storedSettings) as AppearanceSettings;
    }
  } catch (error) {
    console.error('Error loading appearance settings from localStorage:', error);
  }
  // Return defaults if nothing stored or error occurred
  return {
    fontSize: 16,
    fontFamily: 'sans-serif',
    margin: 4,
  };
};

// Utility to safely save settings to localStorage
const saveAppearanceSettings = (settings: AppearanceSettings) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving appearance settings to localStorage:', error);
  }
};

export default function TranslatePage() {
  const router = useRouter();
  const { id, chapter } = router.query;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(1);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [shouldCancelBatch, setShouldCancelBatch] = useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);
  const [liveAppearanceSettings, setLiveAppearanceSettings] = useState<AppearanceSettings>(loadAppearanceSettings());
  const [chapterMetadata, setChapterMetadata] = useState<
    Array<{ number: number; title: string }>
  >([]);
  const [loadedChapters, setLoadedChapters] = useState<TranslationChapter[]>(
    [],
  );

  // Load chapter metadata (for table of contents)
  const loadChapterMetadata = useCallback(async (novelId: string) => {
    try {
      const metadata = await getChapterTOC(novelId);
      setChapterMetadata(metadata);
      return metadata;
    } catch (error) {
      console.error('Failed to load chapter metadata:', error);
      toast.error('Failed to load chapter list');
      return [];
    }
  }, []);

  // Load specific chapters
  const loadChapters = useCallback(
    async (novelId: string, targetIndex: number) => {
      try {
        // If we're creating a new chapter (index beyond current chapters), don't load anything
        // But only apply this check if we have metadata loaded
        if (
          chapterMetadata.length > 0 &&
          targetIndex >= chapterMetadata.length
        ) {
          setLoadedChapters((prevChapters) =>
            prevChapters.filter((ch) => ch.number <= chapterMetadata.length),
          );
          return;
        }

        // Load the target chapter and its neighbors
        const start = Math.max(targetIndex - 1, 0);
        const end = targetIndex + 1;

        const loadedNovel = await getNovel(novelId, {
          start: start + 1,
          end: end + 1,
        });
        if (loadedNovel && loadedNovel.chapters) {
          setLoadedChapters((prevChapters) => {
            // Merge new chapters with existing ones
            const newChapters = [...prevChapters];
            loadedNovel.chapters.forEach((chapter) => {
              const index = newChapters.findIndex(
                (c) => c.number === chapter.number,
              );
              if (index >= 0) {
                newChapters[index] = chapter;
              } else {
                newChapters.push(chapter);
              }
            });
            return newChapters.sort((a, b) => a.number - b.number);
          });
        }
      } catch (error) {
        console.error('Failed to load chapters:', error);
        toast.error('Failed to load chapters');
      }
    },
    [chapterMetadata.length],
  );

  const loadNovel = useCallback(
    async (novelId?: string) => {
      if (!novelId) return;

      NProgress.start();
      try {
        // First load the novel metadata
        const loadedNovel = await getNovel(novelId);
        if (loadedNovel) {
          setNovel(loadedNovel);

          // Load chapter metadata
          const metadata = await loadChapterMetadata(novelId);

          // Determine initial chapter number
          let initialChapterNumber = 1;
          if (chapter !== undefined) {
            const chapterNumber =
              typeof chapter === 'string' ? parseInt(chapter) : 1;
            if (
              !isNaN(chapterNumber) &&
              chapterNumber >= 1 &&
              // Allow navigating to a new chapter position
              chapterNumber <= metadata.length + 1
            ) {
              initialChapterNumber = chapterNumber;
            }
          } else if (metadata.length > 0) {
            initialChapterNumber = metadata.length;
          }

          // Always set the current chapter number
          setCurrentChapterNumber(initialChapterNumber);

          // Always load initial chapters on first load or chapter change
          await loadChapters(novelId, initialChapterNumber - 1);
        } else {
          toast.error('Novel not found');
          router.push('/');
        }
      } catch (error) {
        console.error('Failed to load novel:', error);
        toast.error('Failed to load novel');
        router.push('/');
      } finally {
        NProgress.done();
      }
    },
    [router, chapter, loadChapterMetadata, loadChapters],
  );

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadNovel(id);
    }
  }, [id, loadNovel]);

  // Effect to load settings from localStorage on initial mount
  useEffect(() => {
    setLiveAppearanceSettings(loadAppearanceSettings());
  }, []);

  // Function to update state and save to localStorage
  const handleAppearanceChange = (newSettings: Partial<AppearanceSettings>) => {
    setLiveAppearanceSettings(prev => {
      const updatedSettings = { ...prev, ...newSettings };
      saveAppearanceSettings(updatedSettings); // Save instantly
      return updatedSettings;
    });
  };

  const handleSaveEdit = async (title: string, translatedContent: string) => {
    if (!novel || !currentChapter) return;

    try {
      // Create updated chapter object
      const updatedChapter: TranslationChapter = {
        ...currentChapter,
        title,
        translatedContent,
        updatedAt: Date.now(),
      };

      // Save the updated chapter
      await addChapterToNovel(novel.id, updatedChapter);

      // Update the loadedChapters state with the new content
      setLoadedChapters((prevChapters) => {
        return prevChapters.map((ch) =>
          ch.number === updatedChapter.number ? updatedChapter : ch,
        );
      });

      // Update the chapter metadata to reflect the new title
      setChapterMetadata((prevMetadata) => {
        return prevMetadata.map((ch) =>
          ch.number === updatedChapter.number
            ? { number: updatedChapter.number, title: updatedChapter.title }
            : ch,
        );
      });

      // Reload the novel to get the updated chapters
      const updatedNovel = await getNovel(novel.id);
      if (updatedNovel) {
        setNovel(updatedNovel);
      }

      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes');
    }
  };

  const handleTranslate = async (
    sourceContent: string,
    useAutoRetry: boolean,
    previousTranslationData?: {
      previousTranslation?: string;
      qualityFeedback?: string;
      useImprovementFeedback?: boolean;
    },
  ) => {
    if (!novel) return;

    setIsTranslating(true);
    const toastId = toast.loading('Starting translation...', {
      duration: Infinity,
    });

    try {
      const result = await performTranslation({
        sourceContent,
        novelId: novel.id,
        currentChapterId: currentChapter?.id,
        useAutoRetry,
        previousTranslationData,
        toastId,
      });

      const translatedLines = result.translatedContent.split('\n');
      const title = translatedLines[0].startsWith('# ')
        ? translatedLines[0].substring(2)
        : `Chapter ${currentChapter?.number ?? currentChapterNumber}`;

      toast.loading('Saving translation...', { id: toastId });

      const updatedChapter: TranslationChapter = currentChapter
        ? {
            ...currentChapter,
            title,
            sourceContent,
            translatedContent: result.translatedContent,
            updatedAt: Date.now(),
            qualityCheck: result.qualityCheck,
          }
        : {
            id: `chapter_${Date.now()}`,
            title,
            sourceContent,
            translatedContent: result.translatedContent,
            number: currentChapterNumber,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            qualityCheck: result.qualityCheck,
          };

      await saveChapter({
        novel,
        chapter: updatedChapter,
        setLoadedChapters,
        setChapterMetadata,
        setNovel,
      });

      toast.dismiss(toastId);
      toast.success(
        useAutoRetry
          ? `Translation complete (with auto-retry)`
          : 'Translation complete',
      );
      return result;
    } catch (error) {
      console.error('Translation error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to translate content');
      throw error;
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBatchTranslate = async (count: number, useAutoRetry: boolean) => {
    if (!novel) return;

    setIsBatchTranslating(true);
    setShouldCancelBatch(false);

    const startingChapter =
      chapterMetadata.reduce(
        (max, chapter) => Math.max(max, chapter.number),
        0,
      ) + 1;

    const toastId = toast.loading(
      `Starting batch translation from chapter ${startingChapter} to ${startingChapter + count - 1}...`,
      { duration: Infinity },
    );

    try {
      for (let i = 0; i < count && !shouldCancelBatch; i++) {
        const targetChapterNumber = startingChapter + i;
        const progress = Math.round(((i + 1) / count) * 100);

        toast.loading(
          `Translating chapter ${targetChapterNumber} (${i + 1}/${count}) - ${progress}% complete`,
          { id: toastId },
        );

        const { title, content } = await scrapeChapter(
          novel.sourceUrl,
          targetChapterNumber,
        );
        const sourceContent = `# ${title}\n\n${content}`;

        const result = await performTranslation({
          sourceContent,
          novelId: novel.id,
          useAutoRetry,
          toastId,
        });

        if (shouldCancelBatch) break;

        const translatedLines = result.translatedContent.split('\n');
        const chapterTitle = translatedLines[0].startsWith('# ')
          ? translatedLines[0].substring(2)
          : `Chapter ${targetChapterNumber}`;

        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}_${targetChapterNumber}`,
          title: chapterTitle,
          sourceContent,
          translatedContent: result.translatedContent,
          number: targetChapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          qualityCheck: result.qualityCheck,
        };

        await saveChapter({
          novel,
          chapter: newChapter,
          setLoadedChapters,
          setChapterMetadata,
          setNovel,
        });
      }

      toast.dismiss(toastId);
      toast.success(
        shouldCancelBatch
          ? 'Batch translation cancelled'
          : 'Batch translation completed successfully',
      );
    } catch (error) {
      console.error('Batch translation error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to complete batch translation');
    } finally {
      setIsBatchTranslating(false);
      setShouldCancelBatch(false);
    }
  };

  const handleBatchRetranslate = async (
    startChapter: number,
    endChapter: number,
    useAutoRetry: boolean,
  ) => {
    if (!novel) return;

    setIsBatchTranslating(true);
    setShouldCancelBatch(false);

    const toastId = toast.loading(
      `Starting bulk retranslation from chapter ${startChapter} to ${endChapter}...`,
      { duration: Infinity },
    );

    try {
      // First load all chapters in the range
      toast.loading('Loading chapters...', { id: toastId });
      const loadedNovel = await getNovel(novel.id, {
        start: startChapter,
        end: endChapter,
      });
      if (!loadedNovel || !loadedNovel.chapters) {
        throw new Error('Failed to load chapters');
      }

      // Update loadedChapters state with the loaded chapters
      setLoadedChapters((prevChapters) => {
        const newChapters = [...prevChapters];
        loadedNovel.chapters.forEach((chapter) => {
          const index = newChapters.findIndex(
            (c) => c.number === chapter.number,
          );
          if (index >= 0) {
            newChapters[index] = chapter;
          } else {
            newChapters.push(chapter);
          }
        });
        return newChapters.sort((a, b) => a.number - b.number);
      });

      for (let i = startChapter; i <= endChapter && !shouldCancelBatch; i++) {
        const progress = Math.round(
          ((i - startChapter + 1) / (endChapter - startChapter + 1)) * 100,
        );

        toast.loading(
          `Retranslating chapter ${i} (${i - startChapter + 1}/${endChapter - startChapter + 1}) - ${progress}% complete`,
          { id: toastId },
        );

        const existingChapter = loadedNovel.chapters.find(
          (ch) => ch.number === i,
        );
        if (!existingChapter) {
          throw new Error(`Chapter ${i} not found`);
        }

        const { title, content } = await scrapeChapter(novel.sourceUrl, i);
        const sourceContent = `# ${title}\n\n${content}`;

        const result = await performTranslation({
          sourceContent,
          novelId: novel.id,
          currentChapterId: existingChapter.id,
          useAutoRetry,
          toastId,
        });

        if (shouldCancelBatch) break;

        const translatedLines = result.translatedContent.split('\n');
        const chapterTitle = translatedLines[0].startsWith('# ')
          ? translatedLines[0].substring(2)
          : `Chapter ${i}`;

        const updatedChapter: TranslationChapter = {
          ...existingChapter,
          title: chapterTitle,
          sourceContent,
          translatedContent: result.translatedContent,
          updatedAt: Date.now(),
          qualityCheck: result.qualityCheck,
        };

        await saveChapter({
          novel,
          chapter: updatedChapter,
          setLoadedChapters,
          setChapterMetadata,
          setNovel,
        });
      }

      toast.dismiss(toastId);
      toast.success(
        shouldCancelBatch
          ? 'Bulk retranslation cancelled'
          : 'Bulk retranslation completed successfully',
      );
    } catch (error) {
      console.error('Bulk retranslation error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to complete bulk retranslation');
    } finally {
      setIsBatchTranslating(false);
      setShouldCancelBatch(false);
    }
  };

  const handleCancelBatchTranslate = () => {
    setShouldCancelBatch(true);
  };

  const handleQualityCheck = async (
    sourceContent: string,
    translatedContent: string,
  ) => {
    if (!novel) return;

    try {
      const qualityCheckResponse = await checkTranslationQuality({
        sourceContent: sourceContent,
        translatedContent,
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
      });

      // If we have a quality check result, update the chapter
      if (qualityCheckResponse && currentChapter) {
        const updatedChapter: TranslationChapter = {
          ...currentChapter,
          qualityCheck: qualityCheckResponse,
          updatedAt: Date.now(),
        };

        await saveChapter({
          novel,
          chapter: updatedChapter,
          setLoadedChapters,
          setChapterMetadata,
          setNovel,
        });
      }

      return qualityCheckResponse;
    } catch (error) {
      console.error('Quality check error:', error);
      throw error;
    }
  };

  const handleNavigate = async (chapterNumber: number) => {
    if (!novel) return;

    NProgress.start();

    try {
      // Update URL without reloading
      router.push(
        {
          pathname: router.pathname,
          query: { ...router.query, chapter: chapterNumber },
        },
        undefined,
        { shallow: true },
      );

      // Load chapters after URL update
      await loadChapters(novel.id, chapterNumber - 1);

      // Only update current chapter number after new chapter is loaded
      setCurrentChapterNumber(chapterNumber);

      // Scroll to top after navigation completes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to navigate to chapter:', error);
      toast.error('Failed to load chapter');
    } finally {
      NProgress.done();
    }
  };

  const handleDeleteLatest = async () => {
    if (!novel) return;

    // Get the latest chapter from metadata
    if (chapterMetadata.length === 0) return;

    if (
      !confirm(
        'Are you sure you want to delete the latest chapter? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      const latestChapter = chapterMetadata[chapterMetadata.length - 1];
      await deleteChapter(novel.id, latestChapter.number);

      // Reload the chapter metadata
      await loadChapterMetadata(novel.id);

      // Navigate to the new latest chapter
      const newIndex = Math.max(0, chapterMetadata.length - 1);
      handleNavigate(newIndex + 1);

      toast.success('Chapter deleted successfully');
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      toast.error('Failed to delete chapter');
    }
  };

  const updateNovelSettings = async (updatedSettings: Partial<Novel>) => {
    if (novel) {
      try {
        const updatedNovel = {
          ...novel,
          ...updatedSettings,
          updatedAt: Date.now(),
        };

        await saveNovel(updatedNovel);
        setNovel(updatedNovel);
        toast.success('Settings updated successfully');
      } catch (error: unknown) {
        console.error('Failed to update settings:', error);
        toast.error('Failed to update settings');
      }
    }
  };

  // Ensure chapters is always an array of TranslationChapter
  const currentChapter =
    currentChapterNumber <= chapterMetadata.length
      ? loadedChapters.find((c) => c.number === currentChapterNumber) || null
      : null;

  // Show loading state or not found message
  if (!novel) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Novel not found</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Head>
        <title>
          {novel.title} - Chapter {currentChapterNumber} - NovelLama
        </title>
      </Head>

      <Toaster />

      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex items-center justify-between py-4">
          <Link
            href="/"
            className="flex items-center space-x-2 text-gray-400 hover:text-gray-300"
          >
            <FiArrowLeft className="h-5 w-5" />
            <span>Back to Novels</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAppearanceSettings(!showAppearanceSettings)}
              className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
              title="Appearance Settings"
            >
              <FiSliders className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
              title="Novel Settings"
            >
              <FiSettings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Appearance Settings Panel */}
        {showAppearanceSettings && (
          <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <h3 className="mb-3 text-lg font-semibold">Appearance Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Font Size (px)</label>
                <input
                  type="number"
                  value={liveAppearanceSettings.fontSize}
                  onChange={(e) => {
                    handleAppearanceChange({ fontSize: parseInt(e.target.value) || 16 });
                  }}
                  className="w-full rounded border bg-gray-700 p-2 text-white"
                  min="10"
                  max="32"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Margin (spacing units)</label>
                <input
                  type="number"
                  value={liveAppearanceSettings.margin}
                  onChange={(e) => {
                    handleAppearanceChange({ margin: parseInt(e.target.value) || 4 });
                  }}
                  className="w-full rounded border bg-gray-700 p-2 text-white"
                  min="0"
                  max="16"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Font Family</label>
                <select
                  value={liveAppearanceSettings.fontFamily}
                  onChange={(e) => {
                    handleAppearanceChange({ fontFamily: e.target.value });
                  }}
                  className="w-full rounded border bg-gray-700 p-2 text-white"
                >
                  <option value="sans-serif">Sans Serif</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <ChapterNavigation
          currentChapter={currentChapterNumber}
          totalChapters={chapterMetadata.length}
          onNavigate={handleNavigate}
          chapters={chapterMetadata}
          onDeleteLatest={
            currentChapterNumber === chapterMetadata.length
              ? handleDeleteLatest
              : undefined
          }
        />

        <TranslationEditor
          chapter={currentChapter}
          onSaveEdit={handleSaveEdit}
          onTranslate={handleTranslate}
          onQualityCheck={handleQualityCheck}
          isTranslating={isTranslating}
          isBatchTranslating={isBatchTranslating}
          onBatchTranslate={handleBatchTranslate}
          onBatchRetranslate={handleBatchRetranslate}
          onCancelBatchTranslate={handleCancelBatchTranslate}
          novelSourceUrl={novel.sourceUrl}
          nextChapterNumber={chapterMetadata.length + 1}
          totalChapters={chapterMetadata.length}
          appearanceSettings={liveAppearanceSettings}
        />

        <ChapterNavigation
          currentChapter={currentChapterNumber}
          totalChapters={chapterMetadata.length}
          onNavigate={handleNavigate}
          chapters={chapterMetadata}
          onDeleteLatest={
            currentChapterNumber === chapterMetadata.length
              ? handleDeleteLatest
              : undefined
          }
        />
      </div>

      {showSettings && novel && (
        <NovelSettings
          novel={novel}
          onClose={() => setShowSettings(false)}
          onSave={updateNovelSettings}
          isOpen={showSettings}
        />
      )}
    </div>
  );
}

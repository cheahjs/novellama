import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { Novel, TranslationChapter } from '@/types';
import {
  getNovel,
  saveNovel,
  addChapterToNovel,
  deleteChapter,
  updateChapter,
  getChapterTOC,
} from '@/services/storage';
import { translateContent } from '@/services/api';
import TranslationEditor from '@/components/translation/TranslationEditor';
import ChapterNavigation from '@/components/translation/ChapterNavigation';
import NovelSettings from '@/components/novel/NovelSettings';
import { toast, Toaster } from 'react-hot-toast';

export default function TranslatePage() {
  const router = useRouter();
  const { id, chapter } = router.query;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(1);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLoadingNovel, setIsLoadingNovel] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [shouldCancelBatch, setShouldCancelBatch] = useState(false);
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
        setIsLoadingNovel(false);
      }
    },
    [router, chapter, loadChapterMetadata, loadChapters],
  );

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadNovel(id);
    }
  }, [id, loadNovel]);

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

    try {
      let finalResult;
      let bestResult;
      let currentAttempt = 0;
      const maxAttempts = 5;

      // If we're using auto-retry, try multiple times to get the best quality
      if (useAutoRetry) {
        while (currentAttempt < maxAttempts) {
          const result = await translateContent({
            sourceContent,
            novelId: novel.id,
            currentChapterId: currentChapter?.id,
            ...(currentAttempt === 0
              ? previousTranslationData
              : bestResult
                ? {
                    previousTranslation: bestResult.translatedContent,
                    qualityFeedback: bestResult.qualityCheck?.feedback || '',
                    useImprovementFeedback:
                      previousTranslationData?.useImprovementFeedback,
                  }
                : {}),
          });

          if (
            !bestResult ||
            (result.qualityCheck?.score || 0) >
              (bestResult.qualityCheck?.score || 0)
          ) {
            bestResult = result;
          }

          if (result.qualityCheck?.isGoodQuality) {
            finalResult = result;
            break;
          }

          currentAttempt++;
        }

        // Use the best result if no good quality was achieved
        finalResult =
          finalResult ||
          bestResult ||
          (await translateContent({
            sourceContent,
            novelId: novel.id,
            currentChapterId: currentChapter?.id,
            ...previousTranslationData,
          }));
      } else {
        // Single translation attempt
        finalResult = await translateContent({
          sourceContent,
          novelId: novel.id,
          currentChapterId: currentChapter?.id,
          ...previousTranslationData,
        });
      }

      const translatedLines = finalResult.translatedContent.split('\n');
      const title = translatedLines[0].startsWith('# ')
        ? translatedLines[0].substring(2)
        : `Chapter ${currentChapter?.number ?? currentChapterNumber}`;

      // Check if we're retranslating an existing chapter
      if (currentChapter) {
        // Update existing chapter
        const updatedChapter: TranslationChapter = {
          ...currentChapter,
          title,
          sourceContent,
          translatedContent: finalResult.translatedContent,
          updatedAt: Date.now(),
          qualityCheck: finalResult.qualityCheck,
        };

        // Save the updated chapter
        await updateChapter(novel.id, updatedChapter);

        // Update the loadedChapters state with the new translation
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
      } else {
        // Create a new chapter
        const chapterNumber = currentChapterNumber;

        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}`,
          title,
          sourceContent,
          translatedContent: finalResult.translatedContent,
          number: chapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          qualityCheck: finalResult.qualityCheck,
        };

        // Save the new chapter
        await addChapterToNovel(novel.id, newChapter);

        // Update the chapter metadata to include the new chapter
        setChapterMetadata((prevMetadata) => [
          ...prevMetadata,
          { number: newChapter.number, title: newChapter.title },
        ]);

        // Update loaded chapters to include the new one
        setLoadedChapters((prevChapters) => [...prevChapters, newChapter]);

        // Reload the novel to get the updated chapters
        const updatedNovel = await getNovel(novel.id);
        if (updatedNovel) {
          setNovel(updatedNovel);
        }
      }

      toast.success('Translation complete');
      setIsTranslating(false);
      return finalResult;
    } catch (error: unknown) {
      console.error('Translation error:', error);
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

    // Find the highest chapter number that exists
    const highestChapterNumber = chapterMetadata.reduce(
      (max: number, chapter: { number: number }) =>
        Math.max(max, chapter.number),
      0,
    );
    const startingChapter = highestChapterNumber + 1;

    // Create a persistent toast that we'll update throughout the process
    const toastId = toast.loading(
      `Starting batch translation from chapter ${startingChapter} to ${startingChapter + count - 1}...`,
      { duration: Infinity },
    );

    try {
      for (let i = 0; i < count; i++) {
        // Check if we should cancel
        if (shouldCancelBatch) {
          toast.dismiss(toastId);
          toast.success('Batch translation cancelled');
          return;
        }

        const targetChapterNumber = startingChapter + i;
        const progress = Math.round(((i + 1) / count) * 100);

        // Update toast with current progress
        toast.loading(
          `Translating chapter ${targetChapterNumber} (${i + 1}/${count}) - ${progress}% complete`,
          { id: toastId },
        );

        // Scrape the next chapter
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: novel.sourceUrl,
            chapterNumber: targetChapterNumber,
            type: 'syosetu',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to scrape chapter ${targetChapterNumber}`);
        }

        const data = await response.json();
        if (!data.title || !data.content) {
          throw new Error(
            `No content found for chapter ${targetChapterNumber}`,
          );
        }

        // Translate the chapter
        const sourceContent = `# ${data.title}\n\n${data.content}`;

        let finalResult;
        if (useAutoRetry) {
          let currentAttempt = 0;
          const maxAttempts = 5;
          let bestResult;

          while (currentAttempt < maxAttempts && !shouldCancelBatch) {
            // Update toast with retry information
            toast.loading(
              `Translating chapter ${targetChapterNumber} (${i + 1}/${count}) - Attempt ${currentAttempt + 1}/5`,
              { id: toastId },
            );

            const result = await translateContent({
              sourceContent,
              novelId: novel.id,
              ...(bestResult
                ? {
                    previousTranslation: bestResult.translatedContent,
                    qualityFeedback: bestResult.qualityCheck?.feedback || '',
                    useImprovementFeedback: true,
                  }
                : {}),
            });

            if (
              !bestResult ||
              (result.qualityCheck?.score || 0) >
                (bestResult.qualityCheck?.score || 0)
            ) {
              bestResult = result;
            }

            if (result.qualityCheck?.isGoodQuality) {
              finalResult = result;
              break;
            }

            currentAttempt++;
          }

          // Check for cancellation after the retry loop
          if (shouldCancelBatch) {
            toast.dismiss(toastId);
            toast.success('Batch translation cancelled');
            return;
          }

          finalResult =
            bestResult ||
            (await translateContent({
              sourceContent,
              novelId: novel.id,
            }));
        } else {
          // Single translation attempt
          finalResult = await translateContent({
            sourceContent,
            novelId: novel.id,
          });
        }

        // Check for cancellation after translation
        if (shouldCancelBatch) {
          toast.dismiss(toastId);
          toast.success('Batch translation cancelled');
          return;
        }

        const translatedLines = finalResult.translatedContent.split('\n');
        const title = translatedLines[0].startsWith('# ')
          ? translatedLines[0].substring(2)
          : `Chapter ${targetChapterNumber}`;

        // Create the new chapter
        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}_${targetChapterNumber}`,
          title,
          sourceContent,
          translatedContent: finalResult.translatedContent,
          number: targetChapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          qualityCheck: finalResult.qualityCheck,
        };

        // Save the chapter
        await addChapterToNovel(novel.id, newChapter);

        // Update the chapter metadata to include the new chapter
        setChapterMetadata((prevMetadata) => [
          ...prevMetadata,
          { number: newChapter.number, title: newChapter.title },
        ]);

        // Update loaded chapters to include the new one
        setLoadedChapters((prevChapters) => [...prevChapters, newChapter]);

        // Reload the novel to get updated chapters
        const updatedNovel = await getNovel(novel.id);
        if (updatedNovel) {
          setNovel(updatedNovel);
        }
      }

      // Update toast to show completion
      toast.dismiss(toastId);
      toast.success('Batch translation completed successfully');
    } catch (error: unknown) {
      console.error('Batch translation error:', error);
      // Update toast to show error
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

    // Create a persistent toast that we'll update throughout the process
    const toastId = toast.loading(
      `Starting bulk retranslation from chapter ${startChapter} to ${endChapter}...`,
      { duration: Infinity },
    );

    try {
      for (let i = startChapter; i <= endChapter; i++) {
        // Check if we should cancel
        if (shouldCancelBatch) {
          toast.dismiss(toastId);
          toast.success('Bulk retranslation cancelled');
          return;
        }

        const progress = Math.round(
          ((i - startChapter + 1) / (endChapter - startChapter + 1)) * 100,
        );

        // Update toast with current progress
        toast.loading(
          `Retranslating chapter ${i} (${i - startChapter + 1}/${endChapter - startChapter + 1}) - ${progress}% complete`,
          { id: toastId },
        );

        // Scrape the chapter
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: novel.sourceUrl,
            chapterNumber: i,
            type: 'syosetu',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to scrape chapter ${i}`);
        }

        const data = await response.json();
        if (!data.title || !data.content) {
          throw new Error(`No content found for chapter ${i}`);
        }

        // Get the existing chapter if it exists
        const existingChapter = loadedChapters.find((ch) => ch.number === i);
        if (!existingChapter) {
          throw new Error(`Chapter ${i} not found`);
        }

        // Translate the chapter
        const sourceContent = `# ${data.title}\n\n${data.content}`;

        let finalResult;
        if (useAutoRetry) {
          let currentAttempt = 0;
          const maxAttempts = 5;
          let bestResult;

          while (currentAttempt < maxAttempts && !shouldCancelBatch) {
            // Update toast with retry information
            toast.loading(
              `Retranslating chapter ${i} - Attempt ${currentAttempt + 1}/5`,
              { id: toastId },
            );

            const result = await translateContent({
              sourceContent,
              novelId: novel.id,
              currentChapterId: existingChapter?.id,
              ...(bestResult
                ? {
                    previousTranslation: bestResult.translatedContent,
                    qualityFeedback: bestResult.qualityCheck?.feedback || '',
                    useImprovementFeedback: true,
                  }
                : {}),
            });

            if (
              !bestResult ||
              (result.qualityCheck?.score || 0) >
                (bestResult.qualityCheck?.score || 0)
            ) {
              bestResult = result;
            }

            if (result.qualityCheck?.isGoodQuality) {
              finalResult = result;
              break;
            }

            currentAttempt++;
          }

          finalResult =
            bestResult ||
            (await translateContent({
              sourceContent,
              novelId: novel.id,
              currentChapterId: existingChapter?.id,
            }));
        } else {
          // Single translation attempt
          finalResult = await translateContent({
            sourceContent,
            novelId: novel.id,
            currentChapterId: existingChapter?.id,
          });
        }

        // Check for cancellation after translation
        if (shouldCancelBatch) {
          toast.dismiss(toastId);
          toast.success('Bulk retranslation cancelled');
          return;
        }

        const translatedLines = finalResult.translatedContent.split('\n');
        const title = translatedLines[0].startsWith('# ')
          ? translatedLines[0].substring(2)
          : `Chapter ${i}`;

        // Create or update the chapter
        const updatedChapter: TranslationChapter = {
          id: existingChapter.id,
          title,
          sourceContent,
          translatedContent: finalResult.translatedContent,
          number: i,
          createdAt: existingChapter.createdAt,
          updatedAt: Date.now(),
          qualityCheck: finalResult.qualityCheck,
        };

        await updateChapter(novel.id, updatedChapter);

        // Update loaded chapters
        setLoadedChapters((prevChapters) => {
          const newChapters = [...prevChapters];
          const index = newChapters.findIndex(
            (ch) => ch.id === updatedChapter.id,
          );
          if (index >= 0) {
            newChapters[index] = updatedChapter;
          } else {
            newChapters.push(updatedChapter);
          }
          return newChapters.sort((a, b) => a.number - b.number);
        });

        // Update the chapter metadata
        setChapterMetadata((prevMetadata) => {
          const newMetadata = [...prevMetadata];
          const index = newMetadata.findIndex((ch) => ch.number === i);
          if (index >= 0) {
            newMetadata[index] = { number: i, title: updatedChapter.title };
          }
          return newMetadata;
        });
      }

      // Update toast to show completion
      toast.dismiss(toastId);
      toast.success('Bulk retranslation completed successfully');

      // Reload the novel to get updated chapters
      const updatedNovel = await getNovel(novel.id);
      if (updatedNovel) {
        setNovel(updatedNovel);
      }
    } catch (error: unknown) {
      console.error('Bulk retranslation error:', error);
      // Update toast to show error
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

  const handleNavigate = async (chapterNumber: number) => {
    if (!novel) return;

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
  if (isLoadingNovel) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Loading novel...</p>
      </div>
    );
  }

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

          <h1 className="text-xl font-bold">{novel.title}</h1>

          <button
            onClick={() => setShowSettings(true)}
            className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
          >
            <FiSettings className="h-5 w-5" />
          </button>
        </div>

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
          isTranslating={isTranslating}
          isBatchTranslating={isBatchTranslating}
          onBatchTranslate={handleBatchTranslate}
          onBatchRetranslate={handleBatchRetranslate}
          onCancelBatchTranslate={handleCancelBatchTranslate}
          novelSourceUrl={novel.sourceUrl}
          nextChapterNumber={chapterMetadata.length + 1}
          totalChapters={chapterMetadata.length}
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

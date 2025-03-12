import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { Novel, TranslationChapter, NovelWithChapters } from '@/types';
import { getNovel, saveNovel, addChapterToNovel } from '@/services/storage';
import { translateContent } from '@/services/api';
import TranslationEditor from '@/components/TranslationEditor';
import ChapterNavigation from '@/components/ChapterNavigation';
import NovelSettings from '@/components/NovelSettings';
import { toast, Toaster } from 'react-hot-toast';

export default function TranslatePage() {
  const router = useRouter();
  const { id, chapter } = router.query;

  const [novel, setNovel] = useState<NovelWithChapters | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNovel, setIsLoadingNovel] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);

  const loadNovel = useCallback(
    async (novelId?: string) => {
      if (!novelId) return;

      try {
        const loadedNovel = await getNovel(novelId);
        if (loadedNovel) {
          setNovel(loadedNovel);
          // If chapter is specified in URL, navigate to it
          if (chapter !== undefined) {
            const chapterIndex =
              typeof chapter === 'string' ? parseInt(chapter) - 1 : 0;
            if (
              !isNaN(chapterIndex) &&
              chapterIndex >= 0 &&
              chapterIndex < (loadedNovel.chapters?.length || 0)
            ) {
              setCurrentChapterIndex(chapterIndex);
              setCurrentChapterNumber(chapterIndex + 1);
            }
          } else if (loadedNovel.chapters?.length > 0) {
            // Default to latest chapter if no chapter specified
            setCurrentChapterIndex(loadedNovel.chapters.length - 1);
            setCurrentChapterNumber(loadedNovel.chapters.length);
          }
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
    [router, chapter],
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
    previousTranslationData?: {
      previousTranslation?: string;
      qualityFeedback?: string;
      useImprovementFeedback?: boolean;
    },
  ) => {
    if (!novel) return;

    setIsLoading(true);

    try {
      // Remove the current chapter from the list of previous chapters
      const previousChapters =
        novel.chapters?.filter(
          (chapter: TranslationChapter) => chapter.id !== currentChapter?.id,
        ) ?? [];
      const result = await translateContent({
        sourceContent,
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
        systemPrompt: novel.systemPrompt,
        references: novel.references,
        previousChapters: previousChapters,
        translationTemplate: novel.translationTemplate,
        ...previousTranslationData, // Spread the optional previous translation data
      });
      const translatedLines = result.translatedContent.split('\n');
      const title = translatedLines[0].startsWith('# ')
        ? translatedLines[0].substring(2)
        : `Chapter ${currentChapter?.number || (novel.chapters?.length ? novel.chapters.length + 1 : 1)}`;

      // Check if we're retranslating an existing chapter
      if (currentChapter) {
        // Update existing chapter
        const updatedChapter: TranslationChapter = {
          ...currentChapter,
          title,
          sourceContent,
          translatedContent: result.translatedContent,
          updatedAt: Date.now(),
          qualityCheck: result.qualityCheck,
        };

        // Save the updated chapter
        await addChapterToNovel(novel.id, updatedChapter);

        // Reload the novel to get the updated chapters
        const updatedNovel = await getNovel(novel.id);
        if (updatedNovel) {
          setNovel(updatedNovel);
        }
      } else {
        // Create a new chapter
        const chapterNumber =
          currentChapter?.number ||
          (novel.chapters?.length ? novel.chapters.length + 1 : 1);

        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}`,
          title,
          sourceContent,
          translatedContent: result.translatedContent,
          number: chapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          qualityCheck: result.qualityCheck,
        };

        // Save the new chapter
        await addChapterToNovel(novel.id, newChapter);

        // Reload the novel to get the updated chapters
        const updatedNovel = await getNovel(novel.id);
        if (updatedNovel) {
          setNovel(updatedNovel);
        }
      }

      toast.success('Translation complete');
      setIsLoading(false);
      return result;
    } catch (error: unknown) {
      console.error('Translation error:', error);
      toast.error('Failed to translate content');
      setIsLoading(false);
      throw error;
    }
  };

  const handleBatchTranslate = async (count: number) => {
    if (!novel) return;

    setIsBatchTranslating(true);
    // Find the highest chapter number that exists
    const highestChapterNumber = novel.chapters.reduce(
      (max: number, chapter: TranslationChapter) =>
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

        // Translate using the API directly
        const result = await translateContent({
          sourceContent,
          sourceLanguage: novel.sourceLanguage,
          targetLanguage: novel.targetLanguage,
          systemPrompt: novel.systemPrompt,
          references: novel.references,
          previousChapters: novel.chapters,
          translationTemplate: novel.translationTemplate,
        });

        const translatedLines = result.translatedContent.split('\n');
        const title = translatedLines[0].startsWith('# ')
          ? translatedLines[0].substring(2)
          : `Chapter ${targetChapterNumber}`;

        // Create the new chapter
        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}_${targetChapterNumber}`,
          title,
          sourceContent,
          translatedContent: result.translatedContent,
          number: targetChapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          qualityCheck: result.qualityCheck,
        };

        // Save the chapter
        await addChapterToNovel(novel.id, newChapter);

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
    }
  };

  const handleNavigate = (index: number) => {
    if (!novel) return;

    if (index >= (novel.chapters?.length || 0)) {
      // When creating a new chapter, update URL and indices
      setCurrentChapterNumber(currentChapterNumber + 1);
      setCurrentChapterIndex(novel.chapters?.length || 0);
      router.push(
        `/translate/${novel.id}/${(novel.chapters?.length || 0) + 1}`,
      );
    } else if (index >= 0 && index < (novel.chapters?.length || 0)) {
      // When navigating existing chapters, update URL and indices
      setCurrentChapterIndex(index);
      setCurrentChapterNumber(index + 1);
      router.push(`/translate/${novel.id}/${index + 1}`);
    }
  };

  const handleDeleteLatest = async () => {
    if (!novel || !novel.chapters || novel.chapters.length === 0) return;

    if (
      !confirm(
        'Are you sure you want to delete the latest chapter? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      const updatedChapters = novel.chapters.slice(0, -1);
      const updatedNovel = {
        ...novel,
        chapters: updatedChapters,
        updatedAt: Date.now(),
      };

      await saveNovel(updatedNovel);
      setNovel(updatedNovel);

      // Navigate to the new latest chapter
      const newIndex = Math.max(0, updatedChapters.length - 1);
      handleNavigate(newIndex);

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

  const currentChapter = novel.chapters?.[currentChapterIndex] || null;

  return (
    <div>
      <Head>
        <title>{novel.title} - Novellama</title>
      </Head>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Toaster position="top-right" />

        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-blue-600 hover:underline"
          >
            <FiArrowLeft className="mr-1" /> Back to Novels
          </Link>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center text-gray-600 hover:text-gray-200"
          >
            <FiSettings className="mr-1" /> Settings
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{novel.title}</h1>
          <p className="text-gray-600">
            {novel.sourceLanguage} → {novel.targetLanguage}
          </p>
        </div>

        <ChapterNavigation
          currentIndex={currentChapterIndex}
          totalChapters={novel.chapters?.length || 0}
          onNavigate={handleNavigate}
          chapters={novel.chapters || []}
          onDeleteLatest={handleDeleteLatest}
        />

        <TranslationEditor
          novel={novel}
          currentChapter={currentChapter}
          currentChapterNumber={currentChapterNumber}
          onTranslate={handleTranslate}
          onSaveEdit={handleSaveEdit}
          isLoading={isLoading}
          onBatchTranslate={novel?.sourceUrl ? handleBatchTranslate : undefined}
          isBatchTranslating={isBatchTranslating}
        />

        <ChapterNavigation
          currentIndex={currentChapterIndex}
          totalChapters={novel.chapters?.length || 0}
          onNavigate={handleNavigate}
          chapters={novel.chapters || []}
          onDeleteLatest={handleDeleteLatest}
        />

        <NovelSettings
          novel={novel}
          onSave={updateNovelSettings}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </main>
    </div>
  );
}

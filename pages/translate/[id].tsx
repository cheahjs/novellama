import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { Novel, TranslationChapter } from '@/types';
import { getNovel, saveNovel, addChapterToNovel } from '@/services/storage';
import { translateContent } from '@/services/api';
import TranslationEditor from '@/components/TranslationEditor';
import ChapterNavigation from '@/components/ChapterNavigation';
import NovelSettings from '@/components/NovelSettings';
import { toast, Toaster } from 'react-hot-toast';

export default function TranslatePage() {
  const router = useRouter();
  const { id } = router.query;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNovel, setIsLoadingNovel] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const loadNovel = async (novelId?: string) => {
    if (!novelId) return;

    try {
      const loadedNovel = await getNovel(novelId);
      if (loadedNovel) {
        setNovel(loadedNovel);
        // Set current chapter to the latest one if it exists
        if (loadedNovel.chapters?.length > 0) {
          const lastChapter = loadedNovel.chapters[loadedNovel.chapters.length - 1];
          setCurrentChapterIndex(loadedNovel.chapters.length - 1);
          // Try to extract chapter number from the last chapter's title
          const chapterMatch = lastChapter.title.match(/Chapter (\d+)/i);
          setCurrentChapterNumber(chapterMatch ? parseInt(chapterMatch[1]) - 1 : loadedNovel.chapters.length - 1);
        }
      } else {
        // Novel not found, redirect to home
        toast.error('Novel not found');
        router.push('/');
      }
    } catch (error: unknown) {
      console.error('Failed to load novel:', error);
      toast.error('Failed to load novel');
      router.push('/');
    } finally {
      setIsLoadingNovel(false);
    }
  };

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadNovel(id);
    }
  }, [id]);

  const handleTranslate = async (sourceContent: string) => {
    if (!novel) return;

    setIsLoading(true);

    try {
      // Remove the current chapter from the list of previous chapters
      const previousChapters = novel.chapters?.filter(
        (chapter) => chapter.id !== currentChapter?.id
      ) ?? [];
      const result = await translateContent({
        sourceContent,
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
        systemPrompt: novel.systemPrompt,
        references: novel.references,
        previousChapters: previousChapters
      });
      const translatedLines = result.translatedContent.split('\n');
      const title = translatedLines[0].startsWith('# ') ? translatedLines[0].substring(2) : `Chapter ${novel.chapters?.length ? novel.chapters.length + 1 : 1}`;

      // Check if we're retranslating an existing chapter
      if (currentChapter) {
        // Update existing chapter
        const updatedChapter: TranslationChapter = {
          ...currentChapter,
          title,
          sourceContent,
          translatedContent: result.translatedContent,
          updatedAt: Date.now()
        };

        // Create new chapters array with updated chapter
        const updatedChapters = [...(novel.chapters || [])];
        updatedChapters[currentChapterIndex] = updatedChapter;

        // Update the novel with the modified chapter
        const updatedNovel = {
          ...novel,
          chapters: updatedChapters,
          updatedAt: Date.now()
        };
        await saveNovel(updatedNovel);
        setNovel(updatedNovel);
      } else {
        // Create a new chapter
        const chapterNumber = novel.chapters?.length ? novel.chapters.length + 1 : 1;

        const newChapter: TranslationChapter = {
          id: `chapter_${Date.now()}`,
          title,
          sourceContent,
          translatedContent: result.translatedContent,
          number: chapterNumber,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Update the novel with the new chapter
        await addChapterToNovel(novel.id, newChapter);
        // Reload the novel to get the updated chapters
        await loadNovel(novel.id);
      }

      toast.success('Translation complete');
      return result;
    } catch (error: unknown) {
      console.error('Translation error:', error);
      toast.error('Failed to translate content');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (index: number) => {
    if (!novel) return;

    if (index >= (novel.chapters?.length || 0)) {
      // When creating a new chapter, update both indices
      setCurrentChapterNumber(currentChapterNumber + 1);
      setCurrentChapterIndex(novel.chapters?.length || 0);
    } else if (index >= 0 && index < (novel.chapters?.length || 0)) {
      // When navigating existing chapters, update both indices
      setCurrentChapterIndex(index);
      // Try to extract chapter number from chapter title
      const chapter = novel.chapters?.[index];
      if (chapter) {
        const chapterMatch = chapter.title.match(/Chapter (\d+)/i);
        setCurrentChapterNumber(chapterMatch ? parseInt(chapterMatch[1]) - 1 : index);
      }
    }
  };

  const updateNovelSettings = async (updatedSettings: Partial<Novel>) => {
    if (novel) {
      try {
        const updatedNovel = {
          ...novel,
          ...updatedSettings,
          updatedAt: Date.now()
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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Toaster position="top-right" />

        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center text-blue-600 hover:underline">
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
        />

        <TranslationEditor
          novel={novel}
          currentChapter={currentChapter}
          currentChapterNumber={currentChapterNumber}
          onTranslate={handleTranslate}
          isLoading={isLoading}
        />

        <ChapterNavigation
          currentIndex={currentChapterIndex}
          totalChapters={novel.chapters?.length || 0}
          onNavigate={handleNavigate}
          chapters={novel.chapters || []}
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
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { Novel, TranslationChapter } from '@/types';
import { getNovel, saveNovel, addChapterToNovel } from '@/services/storage';
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
    
    try {
      // Split content into lines and extract title from first line if it starts with #
      const lines = sourceContent.split('\n');
      
      // Get up to 5 previous chapters for context
      const contextChapters = novel.chapters?.slice(-5) || [];

      // Mock translation response for now - replace with actual API call later
      const response = {
        translatedContent: `Translated: ${sourceContent}`
      };

      const title = lines[0].startsWith('# ') ? lines[0].substring(2) : `Chapter ${novel.chapters?.length ? novel.chapters.length + 1 : 1}`;
      const chapterNumber = novel.chapters?.length ? novel.chapters.length + 1 : 1;

      // Create a new chapter
      const newChapter: TranslationChapter = {
        id: `chapter_${Date.now()}`,
        title,
        sourceContent,
        translatedContent: response.translatedContent,
        number: chapterNumber,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Update the novel with the new chapter
      await addChapterToNovel(novel.id, newChapter);

      // Reload the novel to get the updated chapters
      await loadNovel(novel.id);

      // Navigate to the new chapter
      const updatedNovel = await getNovel(novel.id);
      if (updatedNovel) {
        setCurrentChapterIndex(updatedNovel.chapters?.length ? updatedNovel.chapters.length - 1 : 0);
        setCurrentChapterNumber(currentChapterNumber + 1);
      }
    } catch (error: unknown) {
      console.error('Translation error:', error);
      toast.error('Failed to translate content');
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
          onTranslate={handleTranslate}
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
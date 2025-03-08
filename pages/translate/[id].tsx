import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft, FiSettings } from 'react-icons/fi';
import { Novel, TranslationChunk } from '@/types';
import { getNovel, saveNovel, addChunkToNovel } from '@/services/storage';
import { translateContent } from '@/services/api';
import TranslationEditor from '@/components/TranslationEditor';
import ChunkNavigation from '@/components/ChunkNavigation';
import NovelSettings from '@/components/NovelSettings';
import { toast, Toaster } from 'react-hot-toast';

export default function TranslatePage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNovel, setIsLoadingNovel] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const loadNovel = async () => {
      if (id && typeof id === 'string') {
        try {
          const loadedNovel = await getNovel(id);
          if (loadedNovel) {
            setNovel(loadedNovel);
            // Set current chunk to the latest one if it exists
            if (loadedNovel.chunks.length > 0) {
              const lastChunk = loadedNovel.chunks[loadedNovel.chunks.length - 1];
              setCurrentChunkIndex(loadedNovel.chunks.length - 1);
              // Try to extract chapter number from the last chunk's title
              const chapterMatch = lastChunk.title.match(/Chapter (\d+)/i);
              setCurrentChapterNumber(chapterMatch ? parseInt(chapterMatch[1]) - 1 : loadedNovel.chunks.length - 1);
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
      }
    };

    loadNovel();
  }, [id, router]);

  const handleTranslate = async (sourceContent: string) => {
    if (!novel) return;
    
    setIsLoading(true);
    
    try {
      // Get up to 5 previous chunks for context
      const contextChunks = novel.chunks.slice(-5);
      
      const result = await translateContent({
        sourceContent,
        sourceLanguage: novel.sourceLanguage,
        targetLanguage: novel.targetLanguage,
        systemPrompt: novel.systemPrompt,
        references: novel.references,
        previousChunks: contextChunks
      });

      // Extract title from the first line if it starts with #
      const lines = sourceContent.split('\n');
      const title = lines[0].startsWith('# ') ? lines[0].substring(2) : `Chapter ${novel.chunks.length + 1}`;
      
      // Create a new chunk
      const newChunk: TranslationChunk = {
        id: `chunk_${Date.now()}`,
        title,
        sourceContent,
        translatedContent: result.translatedContent,
        timestamp: Date.now()
      };
      
      // Update the novel with the new chunk
      if (novel) {
        await addChunkToNovel(novel.id, newChunk);
        
        // Reload the novel to get the updated chunks
        const updatedNovel = await getNovel(novel.id);
        if (updatedNovel) {
          setNovel(updatedNovel);
          // Navigate to the new chunk
          setCurrentChunkIndex(updatedNovel.chunks.length - 1);
        }
      }
      
      toast.success('Translation complete');
    } catch (error: unknown) {
      console.error('Translation error:', error);
      toast.error('Failed to translate content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (index: number, isNewChapter?: boolean) => {
    if (!novel) return;

    if (isNewChapter) {
      // When navigating to a new chapter, set both indices
      setCurrentChapterNumber(index);
      setCurrentChunkIndex(novel.chunks.length);
    } else if (index >= 0 && index < novel.chunks.length) {
      // When navigating existing chunks, update both indices
      setCurrentChunkIndex(index);
      // Try to extract chapter number from chunk title
      const chunk = novel.chunks[index];
      const chapterMatch = chunk.title.match(/Chapter (\d+)/i);
      setCurrentChapterNumber(chapterMatch ? parseInt(chapterMatch[1]) - 1 : index);
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

  const currentChunk = novel.chunks[currentChunkIndex] || null;

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
        
        <ChunkNavigation
          currentIndex={currentChunkIndex}
          totalChunks={novel.chunks.length}
          onNavigate={handleNavigate}
          chunks={novel.chunks}
          currentChapterNumber={currentChapterNumber}
        />
        
        <TranslationEditor
          onSubmit={handleTranslate}
          currentChunk={currentChunk}
          isLoading={isLoading}
          novel={novel}
          currentChapterNumber={currentChapterNumber}
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
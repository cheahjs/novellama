import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';
import NovelList from '@/components/NovelList';
import { Novel } from '@/types';
import { getNovels, deleteNovel } from '@/services/storage';
import { toast, Toaster } from 'react-hot-toast';

export default function Home() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load novels from the server
    const loadNovels = async () => {
      try {
        const loadedNovels = await getNovels();
        setNovels(loadedNovels);
      } catch (error) {
        toast.error('Failed to load novels');
      } finally {
        setIsLoading(false);
      }
    };

    loadNovels();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this novel? This action cannot be undone.')) {
      try {
        await deleteNovel(id);
        setNovels(novels.filter(novel => novel.id !== id));
        toast.success('Novel deleted successfully');
      } catch (error) {
        toast.error('Failed to delete novel');
      }
    }
  };

  return (
    <div>
      <Head>
        <title>Novellama - Novel Translation App</title>
        <meta name="description" content="Translate novels chapter by chapter using LLMs" />
      </Head>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Toaster position="top-right" />
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Novellama</h1>
          
          <Link href="/new" 
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus className="mr-1" /> New Novel
          </Link>
        </div>
        
        <p className="mt-2 text-gray-600">
          Translate novels chapter by chapter using AI
        </p>

        {isLoading ? (
          <div className="mt-8 text-center">
            Loading novels...
          </div>
        ) : (
          <>
            <NovelList novels={novels} onDelete={handleDelete} />
            
            {novels.length === 0 && (
              <div className="mt-8 text-center">
                <Link href="/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiPlus className="mr-1" /> Start Your First Translation
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

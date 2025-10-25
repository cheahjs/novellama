import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';
import NovelList from '@/components/novel/NovelList';
import { Novel, NovelSortUpdate } from '@/types';
import { getNovels, deleteNovel, updateNovelOrder } from '@/services/storage';
import { toast, Toaster } from 'react-hot-toast';

export default function Home() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [queue, setQueue] = useState<NovelSortUpdate[][]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadNovels = async () => {
      try {
        const loadedNovels = await getNovels();
        if (isMounted) {
          setNovels(loadedNovels);
        }
      } catch (error) {
        toast.error('Failed to load novels');
        console.error('Error loading novels:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadNovels();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (queue.length === 0 || isSavingOrder) {
      return;
    }

    const nextOrder = queue[0];

    const saveOrder = async () => {
      setIsSavingOrder(true);
      try {
        await updateNovelOrder(nextOrder);
        toast.success('Order updated');
      } catch (error) {
        toast.error('Failed to save order');
        console.error('Error saving novel order:', error);
      } finally {
        setQueue((prev) => prev.slice(1));
        setIsSavingOrder(false);
      }
    };

    saveOrder();
  }, [queue, isSavingOrder]);

  const handleDelete = useCallback(async (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this novel? This action cannot be undone.',
      )
    ) {
      try {
        await deleteNovel(id);
        setNovels(novels.filter((novel) => novel.id !== id));
        toast.success('Novel deleted successfully');
      } catch (error) {
        toast.error('Failed to delete novel');
        console.error('Error deleting novel:', error);
      }
    }
  }, [novels]);

  return (
    <div>
      <Head>
        <title>Novellama - Novel Translation App</title>
        <meta
          name="description"
          content="Translate novels chapter by chapter using LLMs"
        />
      </Head>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Toaster position="top-right" />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Novellama</h1>

          <Link
            href="/new"
            className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <FiPlus className="mr-1" /> New Novel
          </Link>
        </div>

        <p className="mt-2 text-gray-600">
          Translate novels chapter by chapter using AI
        </p>

        {isLoading ? (
          <div className="mt-8 text-center">Loading novels...</div>
        ) : (
          <>
            <NovelList
              novels={novels}
              onDelete={handleDelete}
              onReorder={(ordered) => {
                setNovels((prev) =>
                  prev.map((novel) => {
                    const update = ordered.find((item) => item.id === novel.id);
                    return update ? { ...novel, sortOrder: update.sortOrder } : novel;
                  }),
                );
                setQueue((prev) => [...prev, ordered]);
              }}
            />

            {novels.length === 0 && (
              <div className="mt-8 text-center">
                <Link
                  href="/new"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
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

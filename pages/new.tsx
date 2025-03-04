import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import { Novel } from '@/types';
import { saveNovel } from '@/services/storage';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';

export default function NewNovel() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    sourceLanguage: '',
    targetLanguage: '',
    systemPrompt: 'You are a skilled literary translator. Translate the following text from the source language to the target language. Maintain the tone, style, and cultural nuances where possible. Use appropriate idiomatic expressions in the target language.',
    references: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newNovel: Novel = {
      id: `novel_${Date.now()}`,
      title: formData.title,
      sourceLanguage: formData.sourceLanguage,
      targetLanguage: formData.targetLanguage,
      systemPrompt: formData.systemPrompt,
      references: formData.references.split('\n').filter(line => line.trim()),
      chunks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    saveNovel(newNovel);
    toast.success('Novel created successfully');
    
    // Redirect to the translation page
    router.push(`/translate/${newNovel.id}`);
  };

  return (
    <div>
      <Head>
        <title>Create New Novel - Novellama</title>
      </Head>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Toaster position="top-right" />
        
        <div className="mb-6">
          <Link href="/" className="flex items-center text-blue-600 hover:underline">
            <FiArrowLeft className="mr-1" /> Back to Novels
          </Link>
        </div>
        
        <h1 className="text-2xl font-bold mb-6">Create New Novel Translation</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Novel Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Language</label>
              <input
                type="text"
                name="sourceLanguage"
                value={formData.sourceLanguage}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., Japanese"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Target Language</label>
              <input
                type="text"
                name="targetLanguage"
                value={formData.targetLanguage}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., English"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleChange}
              rows={4}
              className="w-full p-2 border rounded"
              placeholder="Instructions for translation style and guidelines..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Customize how the AI should translate your content, including style preferences.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">References (one per line)</label>
            <textarea
              name="references"
              value={formData.references}
              onChange={handleChange}
              rows={6}
              className="w-full p-2 border rounded"
              placeholder="Character names, terms, wiki links..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Add glossary terms, character names, or wiki links to help with translation.
            </p>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded flex items-center hover:bg-blue-700"
            >
              <FiSave className="mr-2" /> Create Novel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import { Novel } from '@/types';
import { saveNovel } from '@/services/storage';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';
import axios from 'axios';

export default function NewNovel() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const newNovel: Partial<Novel> = {
        title: formData.title,
        sourceLanguage: formData.sourceLanguage,
        targetLanguage: formData.targetLanguage,
        systemPrompt: formData.systemPrompt,
        references: formData.references.split('\n').filter(line => line.trim()),
      };
      
      const response = await axios.post('/api/novels', newNovel);
      toast.success('Novel created successfully');
      
      // Redirect to the translation page
      router.push(`/translate/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create novel:', error);
      toast.error('Failed to create novel');
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">References (one per line)</label>
            <textarea
              name="references"
              value={formData.references}
              onChange={handleChange}
              rows={4}
              className="w-full p-2 border rounded"
              placeholder="Enter reference texts or URLs, one per line..."
              disabled={isSubmitting}
            />
          </div>
          
          <div className="flex justify-end pt-4">
            <Link
              href="/"
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded mr-2 hover:bg-gray-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded flex items-center ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <FiSave className="mr-1" />
              {isSubmitting ? 'Creating...' : 'Create Novel'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

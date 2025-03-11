import React, { useState } from 'react';
import { Novel, Reference } from '@/types';
import { FiSave, FiX } from 'react-icons/fi';
import ReferenceInput from './ReferenceInput';
import ReferenceItem from './ReferenceItem';
import LiveTokenCounter from './LiveTokenCounter';

interface NovelSettingsProps {
  novel: Novel;
  onSave: (updatedNovel: Partial<Novel>) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NovelSettings: React.FC<NovelSettingsProps> = ({
  novel,
  onSave,
  isOpen,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    title: novel.title,
    sourceLanguage: novel.sourceLanguage,
    targetLanguage: novel.targetLanguage,
    systemPrompt: novel.systemPrompt,
    sourceUrl: novel.sourceUrl,
    references: novel.references,
    translationTemplate:
      novel.translationTemplate ||
      'Translate the following text from ${sourceLanguage} to ${targetLanguage}. Make sure to preserve and translate the header.\n\n${sourceContent}',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddReference = (reference: Omit<Reference, 'id'>) => {
    const newReference: Reference = {
      ...reference,
      id: crypto.randomUUID(),
    };
    setFormData((prev) => ({
      ...prev,
      references: [...prev.references, newReference],
    }));
  };

  const handleDeleteReference = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      references: prev.references.filter((ref) => ref.id !== id),
    }));
  };

  const handleEditReference = (updatedReference: Reference) => {
    setFormData((prev) => ({
      ...prev,
      references: prev.references.map((ref) =>
        ref.id === updatedReference.id ? updatedReference : ref,
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Novel Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full rounded border p-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Source Language
              </label>
              <input
                type="text"
                name="sourceLanguage"
                value={formData.sourceLanguage}
                onChange={handleChange}
                className="w-full rounded border p-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Target Language
              </label>
              <input
                type="text"
                name="targetLanguage"
                value={formData.targetLanguage}
                onChange={handleChange}
                className="w-full rounded border p-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Source URL</label>
            <input
              type="url"
              name="sourceUrl"
              value={formData.sourceUrl}
              onChange={handleChange}
              className="w-full rounded border p-2"
              placeholder="https://ncode.syosetu.com/nxxxxxxx/"
              pattern="https://ncode\.syosetu\.com/n[a-z0-9]+/?$"
              title="Please enter a valid syosetu.com novel URL"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              System Prompt
            </label>
            <div className="relative">
              <textarea
                name="systemPrompt"
                value={formData.systemPrompt}
                onChange={handleChange}
                rows={4}
                className="w-full rounded border p-2"
                placeholder="Instructions for translation style and guidelines..."
              />
              <div className="absolute top-2 right-2">
                <LiveTokenCounter
                  text={formData.systemPrompt}
                  className="rounded bg-gray-800 px-2 py-1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Translation Template
            </label>
            <div className="relative">
              <textarea
                name="translationTemplate"
                value={formData.translationTemplate}
                onChange={handleChange}
                rows={4}
                className="w-full rounded border p-2"
                placeholder="Template for translation instruction..."
              />
              <div className="absolute top-2 right-2">
                <LiveTokenCounter
                  text={formData.translationTemplate}
                  className="rounded bg-gray-800 px-2 py-1"
                />
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Available variables: ${'{sourceLanguage}'}, ${'{targetLanguage}'},
              ${'{sourceContent}'}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">References</label>
            <div className="space-y-4">
              {formData.references.map((reference) => (
                <ReferenceItem
                  key={reference.id}
                  reference={reference}
                  onDelete={handleDeleteReference}
                  onEdit={handleEditReference}
                />
              ))}
              <ReferenceInput onAdd={handleAddReference} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <FiSave className="mr-1" /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovelSettings;

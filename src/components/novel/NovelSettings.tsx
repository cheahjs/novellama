import React, { useState } from 'react';
import { Novel, Reference } from '@/types';
import { FiSave, FiX } from 'react-icons/fi';
import { FiDownload, FiUpload } from 'react-icons/fi';
import { exportChapters, importChapters } from '@/services/storage';
import ReferenceInput from '@/components/novel/ReferenceInput';
import ReferenceItem from '@/components/novel/ReferenceItem';
import LiveTokenCounter from '@/components/info/LiveTokenCounter';
import { useConfig } from '@/hooks/useConfig';

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
  const { config } = useConfig();
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
    translationModel: novel.translationModel || '',
    qualityCheckModel: novel.qualityCheckModel || '',
    maxTokens: novel.maxTokens ?? '',
    maxTranslationOutputTokens: novel.maxTranslationOutputTokens ?? '',
    maxQualityCheckOutputTokens: novel.maxQualityCheckOutputTokens ?? '',
  });
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importText, setImportText] = useState<string>('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddReference = (
    reference: Omit<Reference, 'id' | 'createdAt' | 'updatedAt' | 'tokenCount'>,
  ) => {
    const newReference: Reference = {
      ...reference,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    setEditingReferenceId(updatedReference.id);
  };

  const handleSaveEditedReference = (
    reference: Omit<Reference, 'id' | 'createdAt' | 'updatedAt' | 'tokenCount'>,
  ) => {
    if (!editingReferenceId) return;

    const updatedReference: Reference = {
      ...reference,
      id: editingReferenceId,
      updatedAt: Date.now(),
      createdAt: formData.references.find(ref => ref.id === editingReferenceId)?.createdAt || Date.now(),
    };

    setFormData((prev) => ({
      ...prev,
      references: prev.references.map((ref) =>
        ref.id === editingReferenceId ? updatedReference : ref,
      ),
    }));
    setEditingReferenceId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalize numeric fields (empty string => null)
    const normalized: Partial<Novel> = {
      ...formData,
      maxTokens:
        formData.maxTokens === '' ? null : Number(formData.maxTokens),
      maxTranslationOutputTokens:
        formData.maxTranslationOutputTokens === ''
          ? null
          : Number(formData.maxTranslationOutputTokens),
      maxQualityCheckOutputTokens:
        formData.maxQualityCheckOutputTokens === ''
          ? null
          : Number(formData.maxQualityCheckOutputTokens),
      translationModel:
        formData.translationModel && formData.translationModel.trim().length > 0
          ? formData.translationModel.trim()
          : null,
      qualityCheckModel:
        formData.qualityCheckModel && formData.qualityCheckModel.trim().length > 0
          ? formData.qualityCheckModel.trim()
          : null,
    };
    onSave(normalized);
    onClose();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await exportChapters(novel.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = novel.title.replace(/[^a-z0-9_-]+/gi, '_');
      link.download = `${safeTitle}_chapters.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export chapters:', err);
      alert('Failed to export chapters');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      alert('Paste the chapters text to import.');
      return;
    }
    try {
      setIsImporting(true);
      await importChapters(novel.id, importText, importMode);
      alert('Chapters imported successfully. Refresh or reopen to see updates.');
      setImportText('');
    } catch (err) {
      console.error('Failed to import chapters:', err);
      alert('Failed to import chapters');
    } finally {
      setIsImporting(false);
    }
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

          {config?.modelConfigEnable && (
            <div className="rounded border border-gray-700 p-3">
              <div className="mb-2 font-medium">Model & Token Limits (optional)</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Translation Model</label>
                  <input
                    type="text"
                    name="translationModel"
                    value={formData.translationModel}
                    onChange={handleChange}
                    className="w-full rounded border p-2"
                    placeholder="e.g., gpt-4o-mini or gemini-2.0-flash"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave blank to use global default.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Quality Check Model</label>
                  <input
                    type="text"
                    name="qualityCheckModel"
                    value={formData.qualityCheckModel}
                    onChange={handleChange}
                    className="w-full rounded border p-2"
                    placeholder="e.g., gpt-4o or gemini-2.0-pro-exp-02-05"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave blank to use global default.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Context Tokens</label>
                  <input
                    type="number"
                    name="maxTokens"
                    value={formData.maxTokens}
                    onChange={handleChange}
                    className="w-full rounded border p-2"
                    min={0}
                  />
                  <p className="mt-1 text-xs text-gray-500">Used to truncate previous chapter context.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Translation Output Tokens</label>
                  <input
                    type="number"
                    name="maxTranslationOutputTokens"
                    value={formData.maxTranslationOutputTokens}
                    onChange={handleChange}
                    className="w-full rounded border p-2"
                    min={0}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Quality Check Output Tokens</label>
                  <input
                    type="number"
                    name="maxQualityCheckOutputTokens"
                    value={formData.maxQualityCheckOutputTokens}
                    onChange={handleChange}
                    className="w-full rounded border p-2"
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">References</label>
            <div className="space-y-4">
              {formData.references.map((reference) => (
                editingReferenceId === reference.id ? (
                  <div key={reference.id}>
                    <ReferenceInput 
                      onAdd={handleSaveEditedReference} 
                      initialReference={reference}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingReferenceId(null)}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel Edit
                    </button>
                  </div>
                ) : (
                  <ReferenceItem
                    key={reference.id}
                    reference={reference}
                    onDelete={handleDeleteReference}
                    onEdit={handleEditReference}
                  />
                )
              ))}
              {!editingReferenceId && <ReferenceInput onAdd={handleAddReference} />}
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-2">
            <div className="rounded border border-gray-700 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">Export / Import Chapters</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-600 disabled:opacity-50"
                    disabled={isExporting}
                    title="Download all chapters as text"
                  >
                    <FiDownload className="mr-1" /> {isExporting ? 'Exporting…' : 'Export'}
                  </button>
                </div>
              </div>
              <div className="mb-2 text-sm text-gray-400">
                Paste text in this format: headers like &quot;## Chapter N: Title&quot;, then sections &quot;### Source&quot; and &quot;### Translation&quot;. Newlines are preserved.
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                className="w-full rounded border p-2"
                placeholder={"## Chapter 1: Example\n### Source\nOriginal lines...\n\n### Translation\nTranslated lines..."}
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <span>Mode:</span>
                  <select
                    className="rounded border bg-gray-900 p-1"
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                  >
                    <option value="merge">Merge (update/add by chapter number)</option>
                    <option value="replace">Replace (clear all, then import)</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleImport}
                  className="flex items-center rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50"
                  disabled={isImporting}
                  title="Import chapters from pasted text"
                >
                  <FiUpload className="mr-1" /> {isImporting ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovelSettings;

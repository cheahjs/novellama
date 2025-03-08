import React, { useState } from 'react';
import { Novel, Reference } from '@/types';
import { FiSave, FiX } from 'react-icons/fi';
import ReferenceInput from './ReferenceInput';
import ReferenceItem from './ReferenceItem';

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
  onClose 
}) => {
  const [formData, setFormData] = useState({
    title: novel.title,
    sourceLanguage: novel.sourceLanguage,
    targetLanguage: novel.targetLanguage,
    systemPrompt: novel.systemPrompt,
    references: novel.references
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddReference = (reference: Omit<Reference, 'id'>) => {
    const newReference: Reference = {
      ...reference,
      id: crypto.randomUUID()
    };
    setFormData(prev => ({
      ...prev,
      references: [...prev.references, newReference]
    }));
  };

  const handleDeleteReference = (id: string) => {
    setFormData(prev => ({
      ...prev,
      references: prev.references.filter(ref => ref.id !== id)
    }));
  };

  const handleEditReference = (updatedReference: Reference) => {
    setFormData(prev => ({
      ...prev,
      references: prev.references.map(ref => 
        ref.id === updatedReference.id ? updatedReference : ref
      )
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
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
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Language</label>
              <input
                type="text"
                name="sourceLanguage"
                value={formData.sourceLanguage}
                onChange={handleChange}
                className="w-full p-2 border rounded"
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
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">References</label>
            <div className="space-y-4">
              {formData.references.map(reference => (
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
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded mr-2 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded flex items-center hover:bg-blue-700"
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

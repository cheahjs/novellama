import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const useTranslationAPI = (sessionId = 'default') => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Load settings on mount
    getSettings();
  }, []);

  const getSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/settings`);
      setSettings(response.data);
    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const loadSession = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/session/${sessionId}`);
      return response.data;
    } catch (err) {
      setError('Failed to load session data');
      return null;
    }
  };

  const saveSession = async (data) => {
    try {
      await axios.put(`${API_BASE_URL}/session/${sessionId}`, data);
    } catch (err) {
      setError('Failed to save session data');
    }
  };

  const translateText = async (text) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/translate`, {
        text,
        sessionId
      });
      setIsLoading(false);
      return response.data.translation;
    } catch (err) {
      setError(err.response?.data?.error || 'Translation failed');
      setIsLoading(false);
      return null;
    }
  };

  const updateSystemPrompt = async (prompt) => {
    try {
      await axios.post(`${API_BASE_URL}/system-prompt`, {
        sessionId,
        prompt
      });
      await saveSession({
        systemPrompt: prompt,
        references: await loadSession().then(data => data.references || []),
        translations: await loadSession().then(data => data.translations || [])
      });
    } catch (err) {
      setError('Failed to update system prompt');
    }
  };

  const updateReferences = async (references) => {
    try {
      await axios.post(`${API_BASE_URL}/references`, {
        sessionId,
        references
      });
      await saveSession({
        systemPrompt: await loadSession().then(data => data.systemPrompt || ''),
        references,
        translations: await loadSession().then(data => data.translations || [])
      });
    } catch (err) {
      setError('Failed to update references');
    }
  };

  return {
    translateText,
    loadSession,
    saveSession,
    updateSystemPrompt,
    updateReferences,
    getSettings,
    isLoading,
    error,
    settings
  };
};

export default useTranslationAPI;
import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const useTranslationAPI = (sessionId = 'default') => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);

  const translateText = useCallback(async (text) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/translate`, {
        sessionId,
        text
      });
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while translating');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const updateSystemPrompt = useCallback(async (prompt) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await axios.post(`${API_BASE_URL}/system-prompt`, {
        sessionId,
        prompt
      });
      
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while updating the system prompt');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const updateReferences = useCallback(async (references) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await axios.post(`${API_BASE_URL}/references`, {
        sessionId,
        references
      });
      
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while updating references');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const getTranslationContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/context`, {
        params: { sessionId }
      });
      
      return response.data.messages || [];
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while fetching context');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const getSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/settings`);
      setSettings(response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching settings:', err);
      return null;
    }
  }, []);

  return {
    translateText,
    updateSystemPrompt,
    updateReferences,
    getTranslationContext,
    getSettings,
    isLoading,
    error,
    settings
  };
};

export default useTranslationAPI;
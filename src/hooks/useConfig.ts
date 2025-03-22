import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { ClientConfig } from '../../pages/api/config';

interface ConfigState {
  config: ClientConfig | null;
  isLoading: boolean;
  error: string | null;
}

export function useConfig() {
  const [state, setState] = useState<ConfigState>({
    config: null,
    isLoading: true,
    error: null,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const response = await axios.get<ClientConfig>('/api/config');
      setState({
        config: response.data,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        config: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch config',
      });
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<ClientConfig>) => {
    try {
      const response = await axios.post<ClientConfig>('/api/config', updates);
      setState({
        config: response.data,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update config',
      }));
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    ...state,
    updateConfig,
    refreshConfig: fetchConfig,
  };
} 
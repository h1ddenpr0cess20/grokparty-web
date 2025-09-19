import { useCallback, useEffect, useRef, useState } from 'react';
import { FALLBACK_MODELS, type GrokModel } from '@/api/grokClient';
import { useGrokClient } from '@/api/useGrokClient';
import { useSessionStore } from '@/state/sessionStore';

export type ModelsStatus = 'idle' | 'loading' | 'success' | 'error';

export function useGrokModels() {
  const client = useGrokClient();
  const apiKey = useSessionStore((state) => state.apiKey);
  const [models, setModels] = useState<GrokModel[]>(FALLBACK_MODELS);
  const [status, setStatus] = useState<ModelsStatus>(apiKey ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const fetchModels = useCallback(async () => {
    if (!apiKey) {
      setModels(FALLBACK_MODELS);
      setStatus('idle');
      setError(null);
      return FALLBACK_MODELS;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setStatus('loading');
    setError(null);

    try {
      const results = await client.listModels(apiKey);
      if (!controller.signal.aborted) {
        setModels(results);
        setStatus('success');
        return results;
      }
      return results;
    } catch (err) {
      if (controller.signal.aborted) {
        return FALLBACK_MODELS;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('error');
      setModels(FALLBACK_MODELS);
      return FALLBACK_MODELS;
    }
  }, [apiKey, client]);

  useEffect(() => {
    fetchModels();
    return () => {
      inFlight.current?.abort();
    };
  }, [fetchModels]);

  return {
    models,
    status,
    error,
    refresh: fetchModels,
  } as const;
}

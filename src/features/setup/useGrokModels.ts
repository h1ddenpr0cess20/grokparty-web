import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrokModel } from '@/api/grokClient';
import { useGrokClient } from '@/api/useGrokClient';
import { useSessionStore } from '@/state/sessionStore';

export type ModelsStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Fetches and caches available Grok models for selection in the setup flow.
 */
export function useGrokModels() {
  const client = useGrokClient();
  const apiKey = useSessionStore((state) => state.apiKey);
  const [models, setModels] = useState<GrokModel[]>([]);
  const [status, setStatus] = useState<ModelsStatus>(apiKey ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const fetchModels = useCallback(async () => {
    if (!apiKey) {
      setModels([]);
      setStatus('idle');
      setError(null);
      return [];
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
        return [];
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('error');
      setModels([]);
      return [];
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

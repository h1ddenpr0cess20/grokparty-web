import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GrokClientContext } from '@/api/grokClientContext';
import { FALLBACK_MODELS, type GrokModel } from '@/api/grokClient';
import { useGrokModels } from './useGrokModels';
import { useSessionStore } from '@/state/sessionStore';
import { createMockClient, resetSessionStore } from '@/test/testUtils';

describe('useGrokModels', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('returns fallback models when no API key is set', async () => {
    const listModels = vi.fn();
    const client = createMockClient({ listModels });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GrokClientContext.Provider value={client}>
        {children}
      </GrokClientContext.Provider>
    );

    const { result } = renderHook(() => useGrokModels(), { wrapper });

    expect(result.current.status).toBe('idle');
    expect(result.current.models).toEqual(FALLBACK_MODELS);
    expect(listModels).not.toHaveBeenCalled();
  });

  it('fetches models when an API key exists', async () => {
    resetSessionStore();
    useSessionStore.getState().setApiKey('sk-test', { remember: false });

    const models: GrokModel[] = [
      { id: 'grok-custom', name: 'Grok Custom' },
    ];
    const listModels = vi.fn(async () => models);

    const client = createMockClient({ listModels });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GrokClientContext.Provider value={client}>
        {children}
      </GrokClientContext.Provider>
    );

    const { result } = renderHook(() => useGrokModels(), { wrapper });

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.models).toEqual(models);
    expect(listModels).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults on fetch error and surfaces the error message', async () => {
    resetSessionStore();
    useSessionStore.getState().setApiKey('sk-test', { remember: false });

    const listModels = vi.fn(async () => {
      throw new Error('network down');
    });

    const client = createMockClient({ listModels });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GrokClientContext.Provider value={client}>
        {children}
      </GrokClientContext.Provider>
    );

    const { result } = renderHook(() => useGrokModels(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.models).toEqual(FALLBACK_MODELS);
    expect(result.current.error).toBe('network down');
  });
});

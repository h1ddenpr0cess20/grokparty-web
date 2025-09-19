import { useCallback } from 'react';
import { useSessionStore } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

/**
 * Hook for reading/updating the Grok API key with optional persistence.
 */
export function useApiKey() {
  const apiKey = useSessionStore((state) => state.apiKey);
  const rememberApiKey = useSessionStore((state) => state.rememberApiKey);
  const setApiKey = useSessionStore((state) => state.setApiKey);
  const clearApiKey = useSessionStore((state) => state.clearApiKey);

  const saveKey = useCallback(
    (key: string, remember: boolean) => {
      if (!key) {
        clearApiKey();
        return;
      }

      setApiKey(key.trim(), { remember });
      if (remember) {
        showToast({
          variant: 'success',
          title: 'API key saved',
          description: 'We will remember this key on this device until you clear it.',
          durationMs: 4000,
        });
      }
    },
    [setApiKey, clearApiKey],
  );

  return {
    apiKey,
    rememberApiKey,
    setApiKey: saveKey,
    clearApiKey,
  };
}

export function getApiKeyState() {
  const { apiKey, rememberApiKey } = useSessionStore.getState();
  return { apiKey, rememberApiKey };
}

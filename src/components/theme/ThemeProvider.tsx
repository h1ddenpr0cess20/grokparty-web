import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ThemeContext, type ThemeContextValue, type ThemePreference } from './ThemeContext';

const STORAGE_KEY = 'grokparty:webapp:theme';

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const raw = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return raw ?? 'system';
  });

  const resolved = useMemo(() => resolveTheme(preference), [preference]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (preference === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(mq.matches ? 'dark' : 'light');

    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference: setTheme,
    }),
    [preference, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }
  return preference;
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

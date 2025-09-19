import { useMemo, type PropsWithChildren } from 'react';
import { GrokClient } from './grokClient';
import { GrokClientContext } from './grokClientContext';

/**
 * Props for GrokClientProvider.
 */
export interface GrokClientProviderProps extends PropsWithChildren {
  /** Optional override for the Grok API base URL. */
  baseUrl?: string;
}

/**
 * Provides a memoized GrokClient to all descendants via context.
 */
export function GrokClientProvider({ baseUrl, children }: GrokClientProviderProps) {
  const client = useMemo(() => new GrokClient({ baseUrl }), [baseUrl]);
  return <GrokClientContext.Provider value={client}>{children}</GrokClientContext.Provider>;
}

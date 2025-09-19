import { useMemo, type PropsWithChildren } from 'react';
import { GrokClient } from './grokClient';
import { GrokClientContext } from './grokClientContext';

export interface GrokClientProviderProps extends PropsWithChildren {
  baseUrl?: string;
}

export function GrokClientProvider({ baseUrl, children }: GrokClientProviderProps) {
  const client = useMemo(() => new GrokClient({ baseUrl }), [baseUrl]);
  return <GrokClientContext.Provider value={client}>{children}</GrokClientContext.Provider>;
}

import { useContext } from 'react';
import { GrokClientContext } from './grokClientContext';

/**
 * Hook to access the app-wide GrokClient instance.
 * Throws if used outside of <GrokClientProvider/>.
 */
export function useGrokClient() {
  const client = useContext(GrokClientContext);
  if (!client) {
    throw new Error('useGrokClient must be used within a GrokClientProvider');
  }
  return client;
}

import { useContext } from 'react';
import { GrokClientContext } from './grokClientContext';

export function useGrokClient() {
  const client = useContext(GrokClientContext);
  if (!client) {
    throw new Error('useGrokClient must be used within a GrokClientProvider');
  }
  return client;
}

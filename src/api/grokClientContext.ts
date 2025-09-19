import { createContext } from 'react';
import type { GrokClient } from './grokClient';

/**
 * React context providing a singleton GrokClient instance to the tree.
 * Consumers should prefer `useGrokClient()` to access the client.
 */
export const GrokClientContext = createContext<GrokClient | null>(null);

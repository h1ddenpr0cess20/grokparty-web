import { createContext } from 'react';
import type { GrokClient } from './grokClient';

export const GrokClientContext = createContext<GrokClient | null>(null);

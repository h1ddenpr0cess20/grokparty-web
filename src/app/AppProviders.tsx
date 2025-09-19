import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { GrokClientProvider } from '@/api/GrokClientProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <GrokClientProvider baseUrl={import.meta.env.VITE_GROK_API_BASE}>
        {children}
      </GrokClientProvider>
    </ThemeProvider>
  );
}

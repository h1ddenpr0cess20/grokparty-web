import { useEffect, useMemo, useRef } from 'react';
import { ConversationEngine } from './conversationEngine';
import { useGrokClient } from '@/api/useGrokClient';
import { useSessionStore } from '@/state/sessionStore';

/**
 * Hook exposing a memoized ConversationEngine and convenience methods bound to the
 * current API key from the session store.
 */
export function useConversationEngine() {
  const client = useGrokClient();
  const apiKey = useSessionStore((state) => state.apiKey);
  const engineRef = useRef<ConversationEngine | null>(null);

  const engine = useMemo(() => {
    if (!engineRef.current) {
      engineRef.current = new ConversationEngine({ client });
    }
    return engineRef.current;
  }, [client]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  return {
    engine,
    apiKey,
    start: async () => {
      if (!apiKey) {
        throw new Error('Missing API key');
      }
      await engine.start(apiKey);
    },
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    stop: () => engine.stop(),
    isRunning: () => engine.isRunning(),
    isPaused: () => engine.isPaused(),
  } as const;
}

import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { GrokClientContext } from '@/api/grokClientContext';
import type { GrokClient, GrokModel, GrokChatResponse, GrokStreamEvent } from '@/api/grokClient';
import { useSessionStore, getDefaultConfig } from '@/state/sessionStore';

/** Clears persisted state and resets the session store to defaults. */
export function resetSessionStore() {
  localStorage.clear();
  const defaultConfig = getDefaultConfig();
  useSessionStore.setState({
    apiKey: null,
    rememberApiKey: false,
    config: defaultConfig,
    status: 'idle',
    sessionId: null,
    messages: [],
    lastError: null,
  });
}

interface RenderOptions {
  client?: Partial<GrokClient>;
  wrapper?: ComponentType<PropsWithChildren>;
}

/** Renders a component tree with a mocked GrokClient in context. */
export function renderWithClient(ui: ReactElement, options: RenderOptions = {}) {
  const { client = {} as GrokClient, wrapper: OuterWrapper } = options;
  const provider = ({ children }: PropsWithChildren) => (
    <GrokClientContext.Provider value={client as GrokClient}>
      {OuterWrapper ? <OuterWrapper>{children}</OuterWrapper> : children}
    </GrokClientContext.Provider>
  );
  return render(ui, { wrapper: provider });
}

/** Factory for a minimal GrokClient mock suitable for tests. */
export function createMockClient(overrides: Partial<GrokClient> = {}): GrokClient {
  const base = {
    async listModels() {
      return [] as GrokModel[];
    },
    async createChatCompletion() {
      return {
        id: 'mock-response',
        model: 'mock',
        created: Date.now(),
        object: 'chat.completion',
        choices: [],
      } as GrokChatResponse;
    },
    async *streamChatCompletion() {
      yield { type: 'done' } as GrokStreamEvent;
    },
  } satisfies Partial<GrokClient>;

  // Cast through unknown to satisfy the class type (which has private members)
  return Object.assign({} as unknown as GrokClient, base, overrides);
}

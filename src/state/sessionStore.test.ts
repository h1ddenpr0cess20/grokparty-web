import { beforeEach, describe, expect, it } from 'vitest';
import { resetSessionStore } from '@/test/testUtils';
import {
  createEmptyMessage,
  PARTICIPANT_COLORS,
  useSessionStore,
  DEFAULT_PARTICIPANT_TEMPERATURE,
  DEFAULT_PARTICIPANT_ENABLE_SEARCH,
  DEFAULT_PARTICIPANT_ENABLE_CODE_INTERPRETER,
  DEFAULT_PARTICIPANT_ENABLE_X_SEARCH_TOOL,
  SESSION_STORAGE_KEY,
} from './sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('normalizes participant display names and colors when setting participants', () => {
    const store = useSessionStore.getState();
    store.setParticipants([
      createParticipantInput('p1', '  Alice the strategist  ', 'grok-4'),
      createParticipantInput('p2', 'Captain Bob the fearless leader.', 'grok-4'),
    ]);

    const participants = useSessionStore.getState().config.participants;
    expect(participants).toHaveLength(2);
    expect(participants[0].displayName).toBe('Alice the strategist');
    expect(participants[1].displayName).toBe('Captain Bob the fearless leader');
    expect(participants[0].color).toBe(PARTICIPANT_COLORS[0]);
    expect(participants[1].color).toBe(PARTICIPANT_COLORS[1]);
  });

  it('keeps emoji-only personas as display names', () => {
    const store = useSessionStore.getState();
    store.setParticipants([
      createParticipantInput('p1', '😄', 'grok-4'),
      createParticipantInput('p2', '😀 The cheerful one', 'grok-4'),
    ]);

    const participants = useSessionStore.getState().config.participants;
    expect(participants[0].displayName).toBe('😄');
    expect(participants[1].displayName).toBe('😀 The cheerful one');
  });

  it('pads participants after removal to maintain minimum count', () => {
    const store = useSessionStore.getState();
    store.setParticipants([
      createParticipantInput('p1', 'Alice', 'grok-4'),
      createParticipantInput('p2', 'Bob', 'grok-4'),
      createParticipantInput('p3', 'Cara', 'grok-4'),
    ]);

    store.removeParticipant('p3');

    const participants = useSessionStore.getState().config.participants;
    expect(participants).toHaveLength(2);
    expect(participants.map((p) => p.displayName)).toEqual(['Alice', 'Bob']);
  });

  it('resets configuration to defaults', () => {
    const store = useSessionStore.getState();
    store.updateConfig({ mood: 'chaotic', topic: 'space opera' });
    store.resetConfig();

    const config = useSessionStore.getState().config;
    expect(config.conversationType).toBe('conversation');
    expect(config.mood).toBe('friendly');
    expect(config.topic).toBe('');
    expect(config.participants).toHaveLength(2);
    expect(config.participants.every((participant) => participant.displayName.startsWith('Character'))).toBe(true);
  });

  it('manages API key with remember flag and clearing', () => {
    const store = useSessionStore.getState();
    store.setApiKey('sk-test', { remember: true });

    let state = useSessionStore.getState();
    expect(state.apiKey).toBe('sk-test');
    expect(state.rememberApiKey).toBe(true);

    store.clearApiKey();
    state = useSessionStore.getState();
    expect(state.apiKey).toBeNull();
    expect(state.rememberApiKey).toBe(false);
  });

  it('creates empty messages with provided overrides', () => {
const message = createEmptyMessage({
      speakerId: 'p1',
      content: 'hello',
    });

    expect(message.id).toMatch(/[a-z0-9-]+/i);
    expect(message.role).toBe('assistant');
    expect(message.status).toBe('pending');
    expect(message.speakerId).toBe('p1');
    expect(message.content).toBe('hello');
  });

  it('only persists the API key when remember is enabled', () => {
    const store = useSessionStore.getState();
    store.setApiKey('sk-transient');

    let persisted = readPersistedState();
    expect(persisted?.rememberApiKey).toBe(false);
    expect(persisted?.apiKey).toBeNull();

    store.setApiKey('sk-remember-me', { remember: true });
    persisted = readPersistedState();
    expect(persisted?.rememberApiKey).toBe(true);
    expect(persisted?.apiKey).toBe('sk-remember-me');
  });
});

function createParticipantInput(id: string, persona: string, model: string) {
  return {
    id,
    persona,
    model,
    temperature: DEFAULT_PARTICIPANT_TEMPERATURE,
    enableSearch: DEFAULT_PARTICIPANT_ENABLE_SEARCH,
    enableCodeInterpreter: DEFAULT_PARTICIPANT_ENABLE_CODE_INTERPRETER,
    enableXSearchTool: DEFAULT_PARTICIPANT_ENABLE_X_SEARCH_TOOL,
    mcpAccess: [],
  };
}

function readPersistedState() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { state?: { rememberApiKey?: boolean; apiKey?: string | null } };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

import { beforeEach, describe, expect, it } from 'vitest';
import { resetSessionStore } from '@/test/testUtils';
import { createEmptyMessage, PARTICIPANT_COLORS, useSessionStore } from './sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('normalizes participant display names and colors when setting participants', () => {
    const store = useSessionStore.getState();
    store.setParticipants([
      { id: 'p1', persona: '  Alice the strategist  ', model: 'grok-4' },
      { id: 'p2', persona: 'Captain Bob the fearless leader.', model: 'grok-4' },
    ]);

    const participants = useSessionStore.getState().config.participants;
    expect(participants).toHaveLength(2);
    expect(participants[0].displayName).toBe('Alice the strategist');
    expect(participants[1].displayName).toBe('Captain Bob the fearless leader');
    expect(participants[0].color).toBe(PARTICIPANT_COLORS[0]);
    expect(participants[1].color).toBe(PARTICIPANT_COLORS[1]);
  });

  it('pads participants after removal to maintain minimum count', () => {
    const store = useSessionStore.getState();
    store.setParticipants([
      { id: 'p1', persona: 'Alice', model: 'grok-4' },
      { id: 'p2', persona: 'Bob', model: 'grok-4' },
      { id: 'p3', persona: 'Cara', model: 'grok-4' },
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
});

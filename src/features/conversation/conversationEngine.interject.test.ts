import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationEngine } from './conversationEngine';
import { resetSessionStore, createMockClient } from '@/test/testUtils';
import { useSessionStore } from '@/state/sessionStore';
import type { GrokChatRequest } from '@/api/grokClient';

function createStreamingClient(requests: GrokChatRequest[]) {
  return createMockClient({
    async *streamChatCompletion(_apiKey: string, request: GrokChatRequest) {
      requests.push(request);
      yield {
        type: 'message',
        message: { role: 'assistant', content: 'ack' },
      };
      yield { type: 'done' } as const;
    },
  });
}

describe('ConversationEngine interjections', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSessionStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('includes user interjections in the next speaker prompt', async () => {
    const requests: GrokChatRequest[] = [];
    const client = createStreamingClient(requests);
    const engine = new ConversationEngine({ client });

    const runPromise = engine.start('sk-test');
    await Promise.resolve();

    expect(requests.length).toBeGreaterThanOrEqual(1);

    engine.pause();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.runOnlyPendingTimersAsync();

    expect(engine.isPaused()).toBe(true);

    const userMessage = 'Let me speak.';
    const baselineRequests = requests.length;
    useSessionStore.getState().appendMessage({
      id: 'user-message',
      role: 'user',
      content: userMessage,
      status: 'completed',
      createdAt: Date.now(),
    });

    engine.queueUserInterjection(userMessage);
    engine.resume();

    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();

    expect(requests.length).toBeGreaterThan(baselineRequests);
    const prompt =
      requests
        .slice(baselineRequests)
        .map((request) => request.messages?.[1]?.content ?? '')
        .find((content) => content?.includes(userMessage)) ?? '';
    expect(prompt).toContain(`User: ${userMessage}`);
    expect(prompt).toContain('address them directly using the name "User"');

    engine.stop();
    await vi.runOnlyPendingTimersAsync();
    await runPromise;
  });

  it('uses the configured user name when present', async () => {
    const requests: GrokChatRequest[] = [];
    const client = createStreamingClient(requests);
    const engine = new ConversationEngine({ client });

    useSessionStore.getState().updateConfig({ userName: 'Riley' });

    const runPromise = engine.start('sk-test');
    await Promise.resolve();

    engine.pause();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.runOnlyPendingTimersAsync();

    const userMessage = 'Jumping in.';
    const baselineRequests = requests.length;
    useSessionStore.getState().appendMessage({
      id: 'user-message',
      role: 'user',
      content: userMessage,
      status: 'completed',
      createdAt: Date.now(),
    });

    engine.queueUserInterjection(userMessage, 'Riley');
    engine.resume();

    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();

    expect(requests.length).toBeGreaterThan(baselineRequests);
    const prompt =
      requests
        .slice(baselineRequests)
        .map((request) => request.messages?.[1]?.content ?? '')
        .find((content) => content?.includes(userMessage)) ?? '';
    expect(prompt).toContain(`Riley: ${userMessage}`);
    expect(prompt).toContain('name "Riley"');

    engine.stop();
    await vi.runOnlyPendingTimersAsync();
    await runPromise;
  });
});

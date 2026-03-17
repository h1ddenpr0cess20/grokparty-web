import { describe, expect, it, vi } from 'vitest';
import { GrokClient, type GrokChatMessage } from './grokClient';

describe('GrokClient', () => {
  it('parses model list responses', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'grok-4',
            name: 'Grok 4',
            description: 'flagship model',
            max_tokens: 32000,
          },
        ],
      }),
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    const models = await client.listModels('sk-test');

    expect(fetch).toHaveBeenCalledWith('https://api.x.ai/v1/models', expect.any(Object));
    expect(models).toEqual([
      {
        id: 'grok-4',
        name: 'Grok 4',
        description: 'flagship model',
        maxTokens: 32000,
      },
    ]);
  });

  it('filters out grok-2 family models from the API response', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'grok-4',
            name: 'Grok 4',
          },
          {
            id: 'grok-2',
            name: 'Grok 2',
          },
          {
            id: 'grok-2-mini',
            name: 'Grok 2 Mini',
          },
        ],
      }),
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    const models = await client.listModels('sk-test');

    expect(models).toEqual([
      {
        id: 'grok-4',
        name: 'Grok 4',
      },
    ]);
  });

  it('filters out grok-imagine models from the API response', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'grok-4',
            name: 'Grok 4',
          },
          {
            id: 'grok-imagine-image',
            name: 'Grok Imagine Image',
          },
          {
            id: 'grok-imagine-image-pro',
            name: 'Grok Imagine Image Pro',
          },
          {
            id: 'grok-imagine-video',
            name: 'Grok Imagine Video',
          },
        ],
      }),
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    const models = await client.listModels('sk-test');

    expect(models).toEqual([
      {
        id: 'grok-4',
        name: 'Grok 4',
      },
    ]);
  });

  it('throws when no compatible models remain after filtering', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'grok-2',
            name: 'Grok 2',
          },
          {
            id: 'grok-imagine-image',
            name: 'Grok Imagine Image',
          },
        ],
      }),
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    await expect(client.listModels('sk-test')).rejects.toThrow('No compatible models available');
  });

  it('throws on HTTP error', async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    await expect(client.listModels('sk-test')).rejects.toThrow('Grok API request failed (401)');
  });

  it('falls back to non-streaming completion when streaming is unavailable', async () => {
    const message: GrokChatMessage = { role: 'assistant', content: 'Hello!' };

    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'resp-1',
          model: 'grok-4',
          created_at: Date.now(),
          object: 'response',
          output: [
            {
              role: 'assistant',
              content: [{ type: 'output_text', text: message.content }],
            },
          ],
        }),
      });

    const client = new GrokClient({ fetchImpl: fetch });

    const events = [];
    for await (const event of client.streamChatCompletion('sk-test', {
      model: 'grok-4',
      messages: [],
    })) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({ type: 'message', message });
    expect(events[events.length - 1]).toEqual({ type: 'done' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('prefers final output_text entries when tool results are present', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'resp-tool',
        model: 'grok-4',
        created_at: Date.now(),
        object: 'response',
        output: [
          {
            role: 'assistant',
            type: 'tool_result',
            status: 'incomplete',
            content: [
              {
                type: 'tool_result',
                text: 'Searching the web...'
              },
            ],
          },
          {
            role: 'assistant',
            type: 'output_text',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'Found the answer you need.',
              },
            ],
          },
        ],
      }),
    })) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    const response = await client.createChatCompletion('sk-test', {
      model: 'grok-4',
      messages: [],
    });

    expect(response.choices[0]?.message.content).toBe('Found the answer you need.');
    expect(response.choices[0]?.finishReason).toBe('stop');
  });

  it('does not send search_parameters when search is enabled', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse((init?.body as string) ?? '{}');
      expect(payload.search_parameters).toBeUndefined();
      expect(payload.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'web_search' }),
          expect.objectContaining({ type: 'x_search' }),
        ]),
      );
      return {
        ok: true,
        json: async () => ({
          id: 'resp-search',
          model: 'grok-4',
          object: 'response',
          output: [
            {
              role: 'assistant',
              content: [{ type: 'output_text', text: 'Done' }],
            },
          ],
        }),
      } as unknown as Response;
    }) as unknown as typeof global.fetch;

    const client = new GrokClient({ fetchImpl: fetch });
    await client.createChatCompletion('sk-test', {
      model: 'grok-4',
      messages: [],
      disableSearch: false,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

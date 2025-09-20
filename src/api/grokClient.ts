import { z } from 'zod';

/**
 * Public model metadata returned by the Grok API.
 */

const DEFAULT_BASE_URL = import.meta.env.VITE_GROK_API_BASE ?? 'https://api.x.ai/v1';

/**
 * Static list used when the API is unreachable or returns an unexpected payload.
 */
export const FALLBACK_MODELS: GrokModel[] = [
  { id: 'grok-4', name: 'Grok 4' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast' },
  { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast' },
  { id: 'grok-3', name: 'Grok 3' },
];

/**
 * Options for constructing a GrokClient instance.
 */
export interface GrokClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Basic description of a Grok model.
 */
export interface GrokModel {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
}

export type GrokRole = 'system' | 'user' | 'assistant';

/**
 * Single message in a chat transcript sent to/received from the Grok API.
 */
export interface GrokChatMessage {
  role: GrokRole;
  content: string;
  name?: string;
}

/**
 * Request body for chat completions.
 */
export interface GrokChatRequest {
  model: string;
  messages: GrokChatMessage[];
  temperature?: number;
  disableSearch?: boolean;
  searchParameters?: Record<string, unknown> | null;
  stream?: boolean;
}

/**
 * One choice from a non-streaming completion.
 */
export interface GrokCompletionChoice {
  message: GrokChatMessage;
  finish_reason: string | null;
}

/**
 * Response for a non-streaming chat completion.
 */
export interface GrokChatResponse {
  id: string;
  model: string;
  created: number;
  object: 'chat.completion';
  choices: GrokCompletionChoice[];
}

/**
 * Discriminated union of streaming events from the Grok API.
 */
export type GrokStreamEvent =
  | { type: 'chunk'; delta: string; raw: GrokChatCompletionChunk }
  | { type: 'message'; message: GrokChatMessage; raw: GrokChatCompletionChunk }
  | { type: 'done' }
  | { type: 'error'; error: Error; raw?: string };

interface GrokChatCompletionChunkChoice {
  delta?: Partial<GrokChatMessage> & { content?: string };
  message?: GrokChatMessage;
  finish_reason: string | null;
}

interface GrokChatCompletionChunk {
  id: string;
  model: string;
  created: number;
  object: 'chat.completion.chunk';
  choices: GrokChatCompletionChunkChoice[];
}

const grokModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        max_tokens: z.number().optional(),
      }),
    )
    .optional(),
});

const DEFAULT_SEARCH_PARAMETERS = {
  mode: 'auto',
  return_citations: true,
  max_search_results: 10,
  sources: [
    { type: 'web', country: 'us' },
    { type: 'news', country: 'us' },
    { type: 'x' },
  ],
};

/**
 * Thin wrapper around the Grok REST API with helpers for streaming chat completions.
 *
 * - Uses `fetch` by default but accepts a custom implementation for testing.
 * - Provides graceful fallbacks when streaming is unavailable or responses are malformed.
 */
export class GrokClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GrokClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  /**
   * Returns the list of available models for the provided API key.
   * Falls back to a static list when the request fails or the payload is invalid.
   */
  async listModels(apiKey: string): Promise<GrokModel[]> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/models`, {
        headers: this.createHeaders(apiKey),
      });

      if (!response.ok) {
        throw createHttpError(response.status, await response.text());
      }

      const payload = await response.json();
      const parsed = grokModelsResponseSchema.safeParse(payload);

      if (!parsed.success || !parsed.data.data) {
        return FALLBACK_MODELS;
      }

      const filteredModels = parsed.data.data.filter((model) => !model.id.startsWith('grok-2'));

      if (filteredModels.length === 0) {
        return FALLBACK_MODELS;
      }

      return filteredModels.map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
        description: model.description,
        maxTokens: model.max_tokens,
      }));
    } catch (error) {
      console.warn('Failed to fetch Grok models, falling back to defaults:', error);
      return FALLBACK_MODELS;
    }
  }

  /**
   * Performs a non-streaming completion request and returns the full response.
   */
  async createChatCompletion(apiKey: string, request: GrokChatRequest): Promise<GrokChatResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.createHeaders(apiKey),
      body: JSON.stringify({
        ...request,
        stream: false,
        search_parameters: request.disableSearch
          ? null
          : request.searchParameters ?? DEFAULT_SEARCH_PARAMETERS,
      }),
    });

    if (!response.ok) {
      throw createHttpError(response.status, await response.text());
    }

    return (await response.json()) as GrokChatResponse;
  }

  /**
   * Streams a chat completion as server‑sent events, yielding incremental tokens and a final message.
   * Falls back to a non‑streaming request when the server does not support streaming.
   */
  async *streamChatCompletion(
    apiKey: string,
    request: GrokChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<GrokStreamEvent> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.createHeaders(apiKey),
      body: JSON.stringify({
        ...request,
        stream: true,
        search_parameters: request.disableSearch
          ? null
          : request.searchParameters ?? DEFAULT_SEARCH_PARAMETERS,
      }),
      signal,
    });

    if (!response.ok) {
      throw createHttpError(response.status, await response.text());
    }

    if (!response.body) {
      // Streaming is not supported, fall back to non-streaming request
      const completion = await this.createChatCompletion(apiKey, {
        ...request,
        stream: false,
      });
      yield {
        type: 'message',
        message: completion.choices[0]?.message ?? { role: 'assistant', content: '' },
        raw: chunkFromResponse(completion),
      };
      yield { type: 'done' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) {
          continue;
        }

        const data = line.slice(5).trim();
        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data) as GrokChatCompletionChunk;

          const choice = parsed.choices[0];
          if (!choice) {
            continue;
          }

          if (choice.delta?.content) {
            yield { type: 'chunk', delta: choice.delta.content, raw: parsed };
          }

          if (choice.message) {
            yield { type: 'message', message: choice.message, raw: parsed };
          }
        } catch (error) {
          console.error('Failed to parse Grok SSE chunk', error, data);
          yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
        }
      }
    }

    yield { type: 'done' };
  }

  /**
   * Constructs standard headers for Grok API calls.
   */
  private createHeaders(apiKey: string): HeadersInit {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}

/**
 * Converts a non-streaming completion response into a single "chunk" payload shape
 * so downstream consumers can handle both streaming and non-streaming uniformly.
 */
function chunkFromResponse(response: GrokChatResponse): GrokChatCompletionChunk {
  return {
    id: response.id,
    model: response.model,
    created: response.created,
    object: 'chat.completion.chunk',
    choices: response.choices.map((choice) => ({
      message: choice.message,
      finish_reason: choice.finish_reason,
    })),
  } satisfies GrokChatCompletionChunk;
}

/**
 * Creates a descriptive HTTP error with a trimmed payload for logging/toast display.
 */
function createHttpError(status: number, payload: string): Error {
  const detail = payload?.slice?.(0, 400) ?? 'Unknown error';
  return new Error(`Grok API request failed (${status}): ${detail}`);
}

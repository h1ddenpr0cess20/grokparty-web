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
  object: 'chat.completion' | 'response';
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

const DEFAULT_RESPONSES_TOOLS = [
  { type: 'web_search' as const },
  { type: 'x_search' as const },
];

type ResponsesToolType = (typeof DEFAULT_RESPONSES_TOOLS)[number]['type'];

interface ResponsesApiInputItem {
  role: GrokRole;
  content: string;
}

interface ResponsesApiPayload {
  model: string;
  input: ResponsesApiInputItem[];
  temperature?: number;
  tools?: ResponsesApiTool[];
  stream?: boolean;
}

interface ResponsesApiTool {
  type: ResponsesToolType;
}

interface ResponsesApiResponse {
  id: string;
  object: string;
  model: string;
  created?: number;
  created_at?: number;
  output?: ResponsesApiOutput[];
}

interface ResponsesApiOutput {
  id?: string;
  role?: string;
  type?: string;
  status?: string;
  content?: ResponsesApiOutputContent[];
}

interface ResponsesApiOutputContent {
  type?: string;
  text?: string;
}

interface ResponsesApiStreamDelta {
  id?: string;
  type?: string;
  response_id?: string;
  response?: ResponsesApiResponse;
  delta?: string;
  output_index?: number;
  content_block_index?: number;
  output?: ResponsesApiOutput[];
  error?: { message?: string };
}

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
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: this.createHeaders(apiKey),
      body: JSON.stringify(buildResponsesPayload(request, false)),
    });

    if (!response.ok) {
      throw createHttpError(response.status, await response.text());
    }

    const payload = (await response.json()) as ResponsesApiResponse;
    return normalizeResponsesPayload(payload);
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
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: this.createHeaders(apiKey),
      body: JSON.stringify(buildResponsesPayload(request, true)),
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
    let collectedText = '';
    let completed = false;
    let shouldStop = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      const segments = buffer.split('\n\n');
      buffer = segments.pop() ?? '';

      for (const segment of segments) {
        const event = parseSseEvent(segment);
        if (!event?.data) {
          continue;
        }

        if (event.data === '[DONE]') {
          shouldStop = true;
          break;
        }

        const payload = safeJsonParse<ResponsesApiStreamDelta>(event.data);
        if (!payload) {
          continue;
        }

        const eventType = event.eventName ?? payload.type;
        const maybeCompletionChunk = payload as unknown as GrokChatCompletionChunk;
        if (Array.isArray(maybeCompletionChunk?.choices)) {
          const choice = maybeCompletionChunk.choices[0];
          if (choice?.delta?.content) {
            collectedText += choice.delta.content;
            yield { type: 'chunk', delta: choice.delta.content, raw: maybeCompletionChunk };
          }
          if (choice?.message) {
            collectedText = choice.message.content ?? collectedText;
            yield { type: 'message', message: choice.message, raw: maybeCompletionChunk };
          }
          continue;
        }

        if (eventType === 'response.output_text.delta' || eventType === 'response.delta') {
          const delta = payload.delta ?? extractDeltaFromOutputs(payload.output ?? payload.response?.output);
          if (delta) {
            const responseId = payload.response_id ?? payload.id ?? payload.response?.id ?? `resp_${Date.now()}`;
            collectedText += delta;
            yield {
              type: 'chunk',
              delta,
              raw: chunkFromDelta(responseId, request.model, delta),
            };
          }
          continue;
        }

        if (eventType === 'response.completed' || eventType === 'response.output_text.completed') {
          const normalized = normalizeResponsesPayload(payload.response ?? (payload as ResponsesApiResponse));
          yield {
            type: 'message',
            message: normalized.choices[0]?.message ?? { role: 'assistant', content: collectedText },
            raw: chunkFromResponse(normalized),
          };
          completed = true;
          shouldStop = true;
          break;
        }

        if (eventType === 'response.error' || payload.error) {
          const error = new Error(payload.error?.message ?? 'Grok streaming request failed');
          yield { type: 'error', error, raw: event.data };
          return;
        }
      }

      if (shouldStop) {
        break;
      }
    }

    if (!completed && collectedText) {
      const normalized = normalizeResponsesPayload({
        id: `resp_${Date.now()}`,
        object: 'response',
        model: request.model,
        output: [
          {
            role: 'assistant',
            content: [{ type: 'output_text', text: collectedText }],
          },
        ],
      });

      yield {
        type: 'message',
        message: normalized.choices[0]?.message ?? { role: 'assistant', content: collectedText },
        raw: chunkFromResponse(normalized),
      };

      completed = true;
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

function chunkFromDelta(id: string, model: string, delta: string): GrokChatCompletionChunk {
  return {
    id,
    model,
    created: Math.floor(Date.now() / 1000),
    object: 'chat.completion.chunk',
    choices: [
      {
        delta: { role: 'assistant', content: delta },
        finish_reason: null,
      },
    ],
  };
}

function buildResponsesPayload(request: GrokChatRequest, stream: boolean): ResponsesApiPayload {
  const payload: ResponsesApiPayload = {
    model: request.model,
    input: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    stream,
  };

  if (typeof request.temperature === 'number') {
    payload.temperature = request.temperature;
  }

  if (!request.disableSearch) {
    payload.tools = DEFAULT_RESPONSES_TOOLS;
  }

  return payload;
}

function normalizeResponsesPayload(payload: ResponsesApiResponse): GrokChatResponse {
  const message = extractMessageFromOutputs(payload.output);
  const finishReason = payload.output?.[0]?.status === 'incomplete' ? 'incomplete' : 'stop';
  return {
    id: payload.id,
    model: payload.model,
    created: payload.created ?? payload.created_at ?? Math.floor(Date.now() / 1000),
    object: payload.object === 'response' ? 'response' : 'chat.completion',
    choices: [
      {
        message,
        finish_reason: finishReason,
      },
    ],
  };
}

function extractMessageFromOutputs(output?: ResponsesApiOutput[]): GrokChatMessage {
  const first = output?.[0];
  const text = first?.content
    ?.map((item) => item.text?.trim())
    .filter(Boolean)
    .join('\n')
    ?.trim();
  return {
    role: (first?.role as GrokRole) ?? 'assistant',
    content: text ?? '',
  };
}

function extractDeltaFromOutputs(output?: ResponsesApiOutput[]): string | undefined {
  const message = extractMessageFromOutputs(output);
  return message.content || undefined;
}

function parseSseEvent(block: string): { eventName?: string; data?: string } | null {
  const lines = block.split('\n');
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return { eventName, data: dataLines.join('\n') };
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse SSE payload', error, value);
    return null;
  }
}

/**
 * Creates a descriptive HTTP error with a trimmed payload for logging/toast display.
 */
function createHttpError(status: number, payload: string): Error {
  const detail = payload?.slice?.(0, 400) ?? 'Unknown error';
  return new Error(`Grok API request failed (${status}): ${detail}`);
}

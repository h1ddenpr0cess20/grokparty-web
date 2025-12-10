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

export interface GrokMcpTool {
  type: 'mcp';
  server_url: string;
  server_label: string;
  allowed_tool_names?: string[];
}

export type GrokTool = GrokMcpTool;

/**
 * Single message in a chat transcript sent to/received from the Grok API.
 */
export interface GrokChatMessage {
  role: GrokRole;
  content: string;
  name?: string;
}

/**
 * Request payload for the Grok Responses API.
 */
export interface GrokChatRequest {
  model: string;
  messages: GrokChatMessage[];
  temperature?: number;
  disableSearch?: boolean;
  stream?: boolean;
  tools?: GrokTool[];
}

/**
 * Normalized response payload returned to the UI layer.
 */
export interface GrokResponseChoice {
  message: GrokChatMessage;
  finishReason: string | null;
}

export interface GrokResponse {
  id: string;
  model: string;
  created: number;
  object: 'response';
  choices: GrokResponseChoice[];
}

/**
 * Discriminated union of streaming events from the Grok API.
 */
export type GrokStreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'message'; message: GrokChatMessage }
  | { type: 'done' }
  | { type: 'error'; error: Error; raw?: string };

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
  search_parameters?: ResponsesSearchParameters;
  stream?: boolean;
}

type ResponsesApiTool = { type: ResponsesToolType } | GrokMcpTool;

interface ResponsesSearchParameters {
  mode?: 'off' | 'auto' | 'on';
  return_citations?: boolean;
  sources?: unknown[];
  from_date?: string;
  to_date?: string;
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
 * Thin wrapper around the Grok REST API with helpers for the Responses endpoint.
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
   * Performs a non-streaming Responses request and returns the normalized payload.
   */
  async createChatCompletion(apiKey: string, request: GrokChatRequest): Promise<GrokResponse> {
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
   * Streams a response as server‑sent events, yielding incremental tokens and a final message.
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
      const fullResponse = await this.createChatCompletion(apiKey, {
        ...request,
        stream: false,
      });
      yield {
        type: 'message',
        message: fullResponse.choices[0]?.message ?? { role: 'assistant', content: '' },
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

        if (eventType === 'response.output_text.delta' || eventType === 'response.delta') {
          const delta = payload.delta ?? extractDeltaFromOutputs(payload.output ?? payload.response?.output);
          if (!delta) {
            continue;
          }
          collectedText += delta;
          yield { type: 'chunk', delta };
          continue;
        }

        if (eventType === 'response.completed' || eventType === 'response.output_text.completed') {
          const normalized = normalizeResponsesPayload(payload.response ?? (payload as ResponsesApiResponse));
          const message = normalized.choices[0]?.message ?? { role: 'assistant', content: collectedText };
          const finalMessage = !message.content?.trim() && collectedText
            ? { ...message, content: collectedText }
            : message;
          collectedText = finalMessage.content;
          yield { type: 'message', message: finalMessage };
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

      const message = normalized.choices[0]?.message ?? { role: 'assistant', content: collectedText };
      yield { type: 'message', message };
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

  const tools: ResponsesApiTool[] = [];

  if (!request.disableSearch) {
    tools.push(...DEFAULT_RESPONSES_TOOLS);
    // Context7 xAI docs: return_citations defaults to true; disable to keep transcript clean.
    payload.search_parameters = {
      return_citations: false,
    };
  }

  if (request.tools?.length) {
    tools.push(...request.tools);
  }

  if (tools.length) {
    payload.tools = tools;
  }

  return payload;
}

function normalizeResponsesPayload(payload: ResponsesApiResponse): GrokResponse {
  const message = extractMessageFromOutputs(payload.output);
  const finishReason = deriveFinishReason(payload.output);
  return {
    id: payload.id,
    model: payload.model,
    created: payload.created ?? payload.created_at ?? Math.floor(Date.now() / 1000),
    object: 'response',
    choices: [
      {
        message,
        finishReason,
      },
    ],
  };
}

function extractMessageFromOutputs(output?: ResponsesApiOutput[]): GrokChatMessage {
  if (!output?.length) {
    return { role: 'assistant', content: '' };
  }

  let fallback: GrokChatMessage | null = null;

  for (let index = output.length - 1; index >= 0; index -= 1) {
    const entry = output[index];
    const role = (entry.role as GrokRole) ?? 'assistant';
    const text = entry.content
      ?.map((item) => item.text?.trim())
      .filter(Boolean)
      .join('\n')
      ?.trim();

    if (!text) {
      continue;
    }

    const candidate: GrokChatMessage = { role, content: text };

    if (!fallback) {
      fallback = candidate;
    }

    if (entry.type === 'output_text') {
      return candidate;
    }
  }

  return fallback ?? { role: (output[output.length - 1]?.role as GrokRole) ?? 'assistant', content: '' };
}

function deriveFinishReason(output?: ResponsesApiOutput[]): 'stop' | 'incomplete' {
  if (!output?.length) {
    return 'stop';
  }
  const last = output[output.length - 1];
  return last?.status === 'incomplete' ? 'incomplete' : 'stop';
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

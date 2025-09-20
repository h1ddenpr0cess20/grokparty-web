import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GrokChatMessage } from '@/api/grokClient';

/**
 * Global conversation lifecycle status values.
 */
export type ConversationFlowStatus =
  | 'idle'
  | 'configuring'
  | 'ready'
  | 'connecting'
  | 'streaming'
  | 'paused'
  | 'completed'
  | 'error';

/**
 * Fully-normalized participant in the session configuration.
 */
export interface Participant {
  id: string;
  displayName: string;
  persona: string;
  model: string;
  color: string;
}

/**
 * Input shape for creating/updating participants via forms.
 */
export interface ParticipantInput {
  id: string;
  persona: string;
  model: string;
}

/**
 * User-configurable options that guide the conversation.
 */
export interface ConversationConfig {
  conversationType: string;
  topic: string;
  setting: string;
  mood: string;
  temperature: number;
  enableSearch: boolean;
  decisionModel: string;
  participants: Participant[];
}

/**
 * Message stored in the transcript with additional metadata used by the UI.
 */
export interface ConversationMessage extends GrokChatMessage {
  id: string;
  speakerId?: string;
  createdAt: number;
  status: 'pending' | 'streaming' | 'completed';
}

/**
 * Zustand store that owns session configuration, transcript and runtime status.
 */
export interface ConversationSessionState {
  apiKey: string | null;
  rememberApiKey: boolean;
  config: ConversationConfig;
  status: ConversationFlowStatus;
  sessionId: string | null;
  messages: ConversationMessage[];
  lastError: string | null;
  setApiKey: (apiKey: string, options?: { remember?: boolean }) => void;
  clearApiKey: () => void;
  updateConfig: (partial: Partial<ConversationConfig>) => void;
  setParticipants: (participants: ParticipantInput[]) => void;
  upsertParticipant: (participant: ParticipantInput) => void;
  removeParticipant: (participantId: string) => void;
  resetConfig: () => void;
  setStatus: (status: ConversationFlowStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  appendMessage: (message: ConversationMessage) => void;
  updateMessage: (
    messageId: string,
    updater: (message: ConversationMessage) => ConversationMessage,
  ) => void;
  clearMessages: () => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
}

const DEFAULT_CONFIG: ConversationConfig = {
  conversationType: 'conversation',
  topic: '',
  setting: '',
  mood: 'friendly',
  temperature: 0.8,
  enableSearch: true,
  decisionModel: 'grok-4',
  participants: [],
};

const STORAGE_KEY = 'grokparty:webapp:session';

/**
 * Palette used to assign stable avatar dots per-participant.
 */
export const PARTICIPANT_COLORS = [
  '#f97316',
  '#0ea5e9',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
];

const createDefaultParticipant = (index: number): Participant =>
  formatParticipant(
    {
      id: createId(),
      persona: '',
      model: DEFAULT_CONFIG.decisionModel,
    },
    index,
  );

function withDefaultParticipants(config: ConversationConfig): ConversationConfig {
  if (config.participants.length >= 2) {
    return config;
  }

  const participants = [...config.participants];
  while (participants.length < 2) {
    participants.push(createDefaultParticipant(participants.length));
  }

  return {
    ...config,
    participants,
  };
}

/**
 * Root session store with localStorage persistence for the API key (opt‑in) and defaults
 * for at least two participants to keep screens stable.
 */
export const useSessionStore = create<ConversationSessionState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      rememberApiKey: false,
      config: withDefaultParticipants(clone(DEFAULT_CONFIG)),
      status: 'idle',
      sessionId: null,
      messages: [],
      lastError: null,

      setApiKey: (apiKey, options) => {
        const remember = options?.remember ?? get().rememberApiKey;
        set({ apiKey, rememberApiKey: remember });
      },

      clearApiKey: () => set({ apiKey: null, rememberApiKey: false }),

      updateConfig: (partial) =>
        set((state) => ({
          config: withDefaultParticipants({ ...state.config, ...partial }),
        })),

      setParticipants: (participants) =>
        set((state) => ({
          config: {
            ...state.config,
            participants: normalizeParticipants(participants),
          },
        })),

      upsertParticipant: (participant) =>
        set((state) => {
          const baseInputs = state.config.participants.map((existing) => ({
            id: existing.id,
            persona: existing.persona,
            model: existing.model,
          }));

          const index = baseInputs.findIndex((entry) => entry.id === participant.id);

          if (index === -1) {
            baseInputs.push(participant);
          } else {
            baseInputs[index] = participant;
          }

          return {
            config: {
              ...state.config,
              participants: normalizeParticipants(baseInputs),
            },
          };
        }),

      removeParticipant: (participantId) =>
        set((state) => {
          const filtered = state.config.participants
            .filter((participant) => participant.id !== participantId)
            .map((participant) => ({
              id: participant.id,
              persona: participant.persona,
              model: participant.model,
            }));

          return {
            config: {
              ...state.config,
              participants: normalizeParticipants(filtered),
            },
          };
        }),

      resetConfig: () =>
        set({
          config: withDefaultParticipants(clone(DEFAULT_CONFIG)),
        }),

      setStatus: (status) => set({ status, lastError: status === 'error' ? get().lastError : null }),

      setSessionId: (sessionId) => set({ sessionId }),

      appendMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      updateMessage: (messageId, updater) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === messageId ? updater(message) : message,
          ),
        })),

      clearMessages: () => set({ messages: [] }),

      setError: (error) => set({ lastError: error, status: error ? 'error' : get().status }),

      resetSession: () =>
        set({
          status: 'idle',
          sessionId: null,
          messages: [],
          lastError: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        rememberApiKey: state.rememberApiKey,
        apiKey: state.rememberApiKey ? state.apiKey : null,
      }),
      merge: (persisted, current) => {
        const persistedState = (persisted as Partial<ConversationSessionState>) ?? {};
        const rememberApiKey = persistedState.rememberApiKey ?? current.rememberApiKey;
        const apiKey = rememberApiKey ? persistedState.apiKey ?? current.apiKey : null;

        return {
          ...current,
          rememberApiKey,
          apiKey,
        };
      },
    },
  ),
);

/**
 * Creates an empty transcript message with sensible defaults and a unique id.
 */
export function createEmptyMessage(partial: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: createId(),
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'pending',
    ...partial,
  };
}

/** Returns a fresh copy of the default configuration (with two starter participants). */
export function getDefaultConfig(): ConversationConfig {
  return clone(withDefaultParticipants(DEFAULT_CONFIG));
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function normalizeParticipants(inputs: Array<Partial<ParticipantInput> & { persona: string; model: string }>): Participant[] {
  return inputs.map((input, index) => formatParticipant(input, index));
}

function formatParticipant(input: Partial<ParticipantInput> & { persona: string; model: string }, index: number): Participant {
  const persona = input.persona.trim();
  return {
    id: input.id ?? createId(),
    displayName: deriveDisplayName(persona, index),
    persona,
    model: input.model,
    color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
  };
}

function deriveDisplayName(persona: string, index: number): string {
  if (!persona) {
    return `Character ${index + 1}`;
  }

  const primary = persona.split(/[.!?\n\r]/)[0]?.trim() ?? persona;
  const cleaned = stripLeadingPersonaArtifacts(primary);

  if (!cleaned) {
    return `Character ${index + 1}`;
  }

  return cleaned.length > 36 ? `${cleaned.slice(0, 33).trimEnd()}…` : cleaned;
}

function stripLeadingPersonaArtifacts(value: string): string {
  let result = value.trimStart();

  const numberedListPrefix = result.match(/^\d{1,3}(?:\s*[-.:)\]])\s*/u);
  if (numberedListPrefix) {
    result = result.slice(numberedListPrefix[0].length);
  }

  result = result.replace(/^(?:[-*•]{1,3})\s*/u, '');
  result = result.replace(/^["'“”‘’`]+/u, '').trimStart();

  return result.trim();
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

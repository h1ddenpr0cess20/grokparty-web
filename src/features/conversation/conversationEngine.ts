import type { GrokClient, GrokChatMessage, GrokTool } from '@/api/grokClient';
import {
  useSessionStore,
  type ConversationConfig,
  type Participant,
  DEFAULT_PARTICIPANT_TEMPERATURE,
} from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

interface ConversationEngineOptions {
  /** Grok API client used to create and stream completions. */
  client: GrokClient;
}

/**
 * Orchestrates a multi‑participant conversation loop against the Grok API.
 *
 * Responsibilities
 * - Drives a streaming turn loop while updating the session store in real time
 * - Handles pause/resume/stop with safe checkpoints between requests
 * - Chooses the next speaker using a model, falling back to randomness on failure
 */
export class ConversationEngine {
  private readonly client: GrokClient;
  private abort = false;
  private paused = false;
  private pauseRequested = false;
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private currentController: AbortController | null = null;
  private history: string[] = [];
  private pendingUserMessages: string[] = [];
  private skipDelayNextTurn = false;
  private userDisplayName = 'User';

  constructor(options: ConversationEngineOptions) {
    this.client = options.client;
  }

  /**
   * Starts the conversation loop. No‑ops if already running.
   */
  async start(apiKey: string) {
    if (this.running) {
      return this.loopPromise;
    }

    const state = useSessionStore.getState();
    const config = state.config;
    if (!config.participants.length || config.participants.length < 2) {
      showToast({
        variant: 'danger',
        title: 'Configuration incomplete',
        description: 'Add at least two participants before starting a conversation.',
        durationMs: 5000,
      });
      return;
    }

    this.abort = false;
    this.paused = false;
    this.running = true;

    this.userDisplayName = config.userName?.trim() || 'User';

    state.clearMessages();
    state.setStatus('connecting');
    state.setSessionId(createId());

    const participants = config.participants;
    this.history = [];
    this.pendingUserMessages = [];
    this.skipDelayNextTurn = false;
    let currentSpeaker = pickInitialSpeaker(participants);

    const runLoop = async () => {
      try {
        await this.emitMessage({
          apiKey,
          config,
          speaker: currentSpeaker,
          isFirst: true,
        });

        while (!this.abort) {
          if (this.skipDelayNextTurn) {
            this.skipDelayNextTurn = false;
          } else {
            await waitFor(1500);
          }

          await this.waitIfPaused();
          if (this.abort) {
            break;
          }

          this.consumePendingUserMessages();

          let nextSpeaker: Participant | null = null;

          while (!this.abort && !nextSpeaker) {
            nextSpeaker = await this.chooseNextSpeaker({
              apiKey,
              config,
              participants,
              currentSpeaker,
            });

            await this.waitIfPaused();
            if (this.abort) {
              break;
            }

            if (this.consumePendingUserMessages()) {
              nextSpeaker = null;
            }
          }

          if (this.abort || !nextSpeaker) {
            break;
          }

          await this.waitIfPaused();
          if (this.abort) {
            break;
          }

          if (this.consumePendingUserMessages()) {
            continue;
          }

          await this.emitMessage({
            apiKey,
            config,
            speaker: nextSpeaker,
            isFirst: false,
          });

          currentSpeaker = nextSpeaker;
        }

        if (!this.abort) {
          state.setStatus('completed');
        }
      } catch (error) {
        console.error('Conversation loop error', error);
        state.setError(error instanceof Error ? error.message : 'Conversation failed');
        showToast({
          variant: 'danger',
          title: 'Conversation failed',
          description: error instanceof Error ? error.message : 'Unexpected error occurred.',
          durationMs: 6000,
        });
      } finally {
        this.running = false;
        this.abort = false;
        this.paused = false;
        this.pauseRequested = false;
        this.pendingUserMessages = [];
        this.skipDelayNextTurn = false;
        this.currentController?.abort();
        this.currentController = null;
        if (useSessionStore.getState().status !== 'completed') {
          useSessionStore.getState().setStatus('idle');
        }
      }
    };

    this.loopPromise = runLoop();
    return this.loopPromise;
  }

  /** Requests that the engine pause at the next safe checkpoint. */
  pause() {
    if (!this.running || this.paused || this.pauseRequested) {
      return;
    }
    // Defer pausing until the current in-flight API call completes.
    // We will flip to paused at the next safe checkpoint in the loop.
    this.pauseRequested = true;
  }

  /** Resumes a paused conversation. */
  resume() {
    if (!this.running || !this.paused) {
      return;
    }
    this.paused = false;
    this.pauseRequested = false;
    useSessionStore.getState().setStatus('streaming');
  }

  /** Queues a user-authored interjection to be considered before the next turn. */
  queueUserInterjection(message: string, authorName?: string) {
    if (!this.running) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    if (authorName) {
      this.userDisplayName = authorName.trim() || this.userDisplayName;
    }
    this.pendingUserMessages = [trimmed];
    this.skipDelayNextTurn = true;
  }

  /** Clears any pending interjection without resuming playback. */
  clearPendingInterjection() {
    this.pendingUserMessages = [];
    this.skipDelayNextTurn = false;
    if (this.pauseRequested && !this.paused) {
      this.pauseRequested = false;
    }
  }

  /** Stops the current run and marks the session completed. */
  stop() {
    if (!this.running) {
      return;
    }
    this.abort = true;
    this.paused = false;
    this.pauseRequested = false;
    this.pendingUserMessages = [];
    this.skipDelayNextTurn = false;
    this.currentController?.abort();
    useSessionStore.getState().setStatus('completed');
  }

  /** Returns true while the engine is actively running. */
  isRunning() {
    return this.running;
  }

  /** Returns true when the engine is paused. */
  isPaused() {
    return this.paused;
  }

  /**
   * Emits a single message for the given speaker, streaming tokens into the transcript.
   */
  private async emitMessage({
    apiKey,
    config,
    speaker,
    isFirst,
  }: {
    apiKey: string;
    config: ConversationConfig;
    speaker: Participant;
    isFirst: boolean;
  }) {
    const state = useSessionStore.getState();
    state.setStatus(isFirst ? 'connecting' : 'streaming');

    const messageId = createId();
    state.appendMessage({
      id: messageId,
      role: 'assistant',
      content: '',
      speakerId: speaker.id,
      createdAt: Date.now(),
      status: 'pending',
    });

    const messages = buildPrompt({ config, speaker, history: this.history, isFirst });
    const controller = new AbortController();
    this.currentController = controller;

    try {
      const speakerTemperature = Number.isFinite(speaker.temperature)
        ? speaker.temperature
        : DEFAULT_PARTICIPANT_TEMPERATURE;
      const mcpTools = buildToolsForParticipant(speaker, config);

      for await (const event of this.client.streamChatCompletion(
        apiKey,
        {
          model: speaker.model,
          messages,
          temperature: speakerTemperature,
          disableSearch: !speaker.enableSearch,
          tools: mcpTools.length ? mcpTools : undefined,
        },
        controller.signal,
      )) {
        if (event.type === 'chunk') {
          state.updateMessage(messageId, (prev) => ({
            ...prev,
            status: 'streaming',
            content: stripCitationArtifacts(prev.content + event.delta),
            createdAt: Date.now(),
          }));
        }
        if (event.type === 'message') {
          state.updateMessage(messageId, (prev) => ({
            ...prev,
            status: 'completed',
            content: stripCitationArtifacts(event.message.content),
            createdAt: Date.now(),
          }));
        }
      }

      state.updateMessage(messageId, (prev) => ({
        ...prev,
        status: 'completed',
      }));

      const final = useSessionStore.getState().messages.find((msg) => msg.id === messageId);
      if (final) {
        this.recordHistoryEntry(speaker.displayName, final.content);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      throw error;
    }
  }

  /** Picks the next speaker, using a model or fallback randomness. */
  private async chooseNextSpeaker({
    apiKey,
    config,
    participants,
    currentSpeaker,
  }: {
    apiKey: string;
    config: ConversationConfig;
    participants: Participant[];
    currentSpeaker: Participant;
  }) {
    if (participants.length === 2) {
      return participants.find((participant) => participant.id !== currentSpeaker.id) ?? currentSpeaker;
    }

    try {
      const response = await this.client.createChatCompletion(apiKey, {
        model: config.decisionModel,
        messages: buildDecisionPrompt({ config, participants, history: this.history }),
        temperature: 0.3,
        disableSearch: true,
      });

      const raw = response.choices[0]?.message.content ?? '';
      const candidateName = raw.split('|')[0]?.trim();
      const match = participants.find((participant) => {
        const normalized = participant.displayName.toLowerCase();
        return normalized === candidateName.toLowerCase();
      });

      if (match) {
        return match;
      }
    } catch (error) {
      console.warn('Failed to determine next speaker', error);
    }

    return pickRandomParticipant(participants, currentSpeaker.id);
  }

  private async waitIfPaused() {
    // If a pause was requested during streaming, transition to paused state now
    // at this safe checkpoint between API calls.
    if (this.pauseRequested && !this.paused) {
      this.paused = true;
      this.pauseRequested = false;
      useSessionStore.getState().setStatus('paused');
    }

    while (this.paused && !this.abort) {
      await waitFor(150);
    }
  }

  private consumePendingUserMessages() {
    if (!this.pendingUserMessages.length) {
      return false;
    }

    for (const message of this.pendingUserMessages) {
      this.recordHistoryEntry(this.userDisplayName, message);
    }

    this.pendingUserMessages = [];
    this.skipDelayNextTurn = true;
    return true;
  }

  private trimHistory() {
    if (this.history.length > 12) {
      this.history.splice(0, this.history.length - 12);
    }
  }

  private recordHistoryEntry(name: string, content: string | undefined) {
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      return;
    }
    const trimmedName = name.trim() || 'Speaker';
    this.history.push(`${trimmedName}: ${trimmedContent}`);
    this.trimHistory();
  }
}

function buildToolsForParticipant(participant: Participant, config: ConversationConfig): GrokTool[] {
  if (!participant.mcpAccess?.length || !config.mcpServers?.length) {
    return [];
  }
  const serverMap = new Map(config.mcpServers.map((server) => [server.id, server]));
  const tools: GrokTool[] = [];

  participant.mcpAccess.forEach((access) => {
    const server = serverMap.get(access.serverId);
    if (!server) {
      return;
    }
    tools.push({
      type: 'mcp',
      server_url: server.url,
      server_label: server.label,
      allowed_tool_names: access.allowedToolNames?.length ? access.allowedToolNames : undefined,
    });
  });

  return tools;
}

function buildPrompt({
  config,
  speaker,
  history,
  isFirst,
}: {
  config: ConversationConfig;
  speaker: Participant;
  history: string[];
  isFirst: boolean;
}): GrokChatMessage[] {
  const systemMessage: GrokChatMessage = {
    role: 'system',
    content: [
      `Assume the personality of ${speaker.persona || speaker.displayName}.`,
      'Roleplay as them and never break character.',
      'Do not speak as anyone else.',
      'Keep responses concise (one to three sentences).',
      'Do not prefix responses with your name.',
    ].join(' '),
  };

  if (isFirst) {
    const others = config.participants
      .filter((participant) => participant.id !== speaker.id)
      .map((participant) => participant.displayName)
      .join(', ');

    return [
      systemMessage,
      {
        role: 'user',
        content: `Start a ${config.conversationType} about ${config.topic || 'anything'} with ${others}. The setting is ${config.setting || 'anywhere'}. The mood is ${config.mood}. Begin naturally.`,
      },
    ];
  }

  const recentHistory = history.slice(-6).join('\n');
  const userName = config.userName?.trim() || 'User';
  const latestEntry = history[history.length - 1] ?? '';
  const userInterjected = latestEntry.startsWith(`${userName}:`);
  const historySection = recentHistory
    ? `Here are the latest messages:\n\n${recentHistory}\n\n`
    : '';
  const followUpInstruction = [
    'Stay focused on the topic and respond in character.',
    userInterjected
      ? `The latest message is from ${userName}—address them directly using the name "${userName}" and answer their message before continuing the broader discussion.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    systemMessage,
    {
      role: 'user',
      content: `You're the next speaker in a ${config.conversationType} about ${config.topic || 'anything'}. The setting is ${config.setting || 'anywhere'}. The mood is ${config.mood}. ${historySection}${followUpInstruction}`,
    },
  ];
}

function buildDecisionPrompt({
  config,
  participants,
  history,
}: {
  config: ConversationConfig;
  participants: Participant[];
  history: string[];
}): GrokChatMessage[] {
  return [
    {
      role: 'user',
      content: `Based on this ${config.conversationType} history, reply with the name of the most likely next speaker (matching the participant name exactly) followed by a pipe and your reasoning. Format: <name>|<reason>. Avoid round-robin patterns.\n\nParticipants: ${participants
        .map((participant) => participant.displayName)
        .join(', ')}\n\nHistory:\n${history.join('\n')}`,
    },
  ];
}

function pickInitialSpeaker(participants: Participant[]) {
  const index = Math.floor(Math.random() * participants.length);
  return participants[index];
}

function pickRandomParticipant(participants: Participant[], excludeId: string) {
  const options = participants.filter((participant) => participant.id !== excludeId);
  if (!options.length) {
    return participants[0];
  }
  const index = Math.floor(Math.random() * options.length);
  return options[index];
}

function waitFor(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CITATION_WITH_URL_REGEX = /\[\d+\]\([^)]*\)/g;
const CITATION_STANDALONE_REGEX = /\[\d+\]/g;
const CITATION_IMAGE_REGEX = /!\[\d+\]\([^)]*\)/g;
const CITATION_DEFINITION_REGEX = /^\[\d+\]:\s*https?:\/\/\S+\s*(?:\n|$)/gm;

export function stripCitationArtifacts(value: string): string {
  if (!value) {
    return '';
  }

  let next = value
    .replace(CITATION_DEFINITION_REGEX, '')
    .replace(CITATION_IMAGE_REGEX, '')
    .replace(CITATION_WITH_URL_REGEX, '')
    .replace(CITATION_STANDALONE_REGEX, '');

  next = next.replace(/[ \t]{2,}/g, ' ');
  next = next.replace(/\s+\n/g, '\n');
  next = next.replace(/\n{3,}/g, '\n\n');
  return next;
}

import type { GrokClient, GrokChatMessage } from '@/api/grokClient';
import { useSessionStore, type ConversationConfig, type Participant } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

interface ConversationEngineOptions {
  client: GrokClient;
}

export class ConversationEngine {
  private readonly client: GrokClient;
  private abort = false;
  private paused = false;
  private pauseRequested = false;
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private currentController: AbortController | null = null;

  constructor(options: ConversationEngineOptions) {
    this.client = options.client;
  }

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

    state.clearMessages();
    state.setStatus('connecting');
    state.setSessionId(createId());

    const participants = config.participants;
    const history: string[] = [];
    let currentSpeaker = pickInitialSpeaker(participants);

    const runLoop = async () => {
      try {
        await this.emitMessage({
          apiKey,
          config,
          speaker: currentSpeaker,
          history,
          isFirst: true,
        });

        while (!this.abort) {
          await waitFor(1500);
          await this.waitIfPaused();
          if (this.abort) {
            break;
          }

          currentSpeaker = await this.chooseNextSpeaker({
            apiKey,
            config,
            participants,
            history,
            currentSpeaker,
          });

          await this.waitIfPaused();
          if (this.abort) {
            break;
          }

          await this.emitMessage({
            apiKey,
            config,
            speaker: currentSpeaker,
            history,
            isFirst: false,
          });
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

  pause() {
    if (!this.running || this.paused || this.pauseRequested) {
      return;
    }
    // Defer pausing until the current in-flight API call completes.
    // We will flip to paused at the next safe checkpoint in the loop.
    this.pauseRequested = true;
  }

  resume() {
    if (!this.running || !this.paused) {
      return;
    }
    this.paused = false;
    this.pauseRequested = false;
    useSessionStore.getState().setStatus('streaming');
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.abort = true;
    this.paused = false;
    this.pauseRequested = false;
    this.currentController?.abort();
    useSessionStore.getState().setStatus('completed');
  }

  isRunning() {
    return this.running;
  }

  isPaused() {
    return this.paused;
  }

  private async emitMessage({
    apiKey,
    config,
    speaker,
    history,
    isFirst,
  }: {
    apiKey: string;
    config: ConversationConfig;
    speaker: Participant;
    history: string[];
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

    const messages = buildPrompt({ config, speaker, history, isFirst });
    const controller = new AbortController();
    this.currentController = controller;

    try {
      for await (const event of this.client.streamChatCompletion(
        apiKey,
        {
          model: speaker.model,
          messages,
          temperature: config.temperature,
          disableSearch: !config.enableSearch,
        },
        controller.signal,
      )) {
        if (event.type === 'chunk') {
          state.updateMessage(messageId, (prev) => ({
            ...prev,
            status: 'streaming',
            content: prev.content + event.delta,
            createdAt: Date.now(),
          }));
        }
        if (event.type === 'message') {
          state.updateMessage(messageId, (prev) => ({
            ...prev,
            status: 'completed',
            content: event.message.content,
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
        history.push(`${speaker.displayName}: ${final.content}`);
      }

      if (history.length > 12) {
        history.splice(0, history.length - 12);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      throw error;
    }
  }

  private async chooseNextSpeaker({
    apiKey,
    config,
    participants,
    history,
    currentSpeaker,
  }: {
    apiKey: string;
    config: ConversationConfig;
    participants: Participant[];
    history: string[];
    currentSpeaker: Participant;
  }) {
    if (participants.length === 2) {
      return participants.find((participant) => participant.id !== currentSpeaker.id) ?? currentSpeaker;
    }

    try {
      const response = await this.client.createChatCompletion(apiKey, {
        model: config.decisionModel,
        messages: buildDecisionPrompt({ config, participants, history }),
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

  return [
    systemMessage,
    {
      role: 'user',
      content: `You're the next speaker in a ${config.conversationType} about ${config.topic || 'anything'}. The setting is ${config.setting || 'anywhere'}. The mood is ${config.mood}. Here are the latest messages:\n\n${recentHistory}\n\nStay focused on the topic and respond in character.`,
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

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

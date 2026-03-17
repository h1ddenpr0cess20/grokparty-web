import { TranscriptActions } from '@/features/conversation/TranscriptActions';
import { useParticipantsMap } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';

/**
 * Review screen summarizing the last conversation and exposing transcript export.
 */
export default function SummaryPage() {
  const messages = useSessionStore((state) => state.messages);
  const config = useSessionStore((state) => state.config);
  const participants = useParticipantsMap();
  const topicDisplay = config.topic?.trim() || 'anything';
  const settingDisplay = config.setting?.trim() || 'anywhere';

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">Summary</p>
        <h1 className="text-foreground text-3xl font-semibold">Conversation summary</h1>
        <p className="text-muted text-base">
          Review the session details, export the transcript, or jump back to configuration to start
          a new run.
        </p>
      </header>

      <div className="border-border bg-surface shadow-card rounded-3xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-muted text-sm font-semibold tracking-wide uppercase">Transcript</h2>
            <p className="text-muted mt-1 text-sm">
              {messages.length
                ? 'Messages below reflect the last conversation session.'
                : 'Run a conversation to populate a transcript.'}
            </p>
          </div>
          <TranscriptActions />
        </div>
        <div className="border-border bg-surface/70 mt-6 max-h-[50vh] overflow-y-auto rounded-2xl border p-4">
          {messages.length ? (
            <ol className="text-foreground space-y-3 text-sm">
              {messages.map((message) => (
                <li key={message.id}>
                  <span className="text-foreground font-semibold">
                    {message.speakerId
                      ? (participants.get(message.speakerId)?.displayName ?? 'Narrator')
                      : 'Narrator'}
                  </span>
                  : {message.content}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">No transcript available yet.</p>
          )}
        </div>
      </div>

      <div className="border-border bg-surface shadow-card rounded-3xl border p-6">
        <h2 className="text-muted text-sm font-semibold tracking-wide uppercase">Configuration</h2>
        <dl className="text-muted mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-foreground font-semibold">Type</dt>
            <dd>{config.conversationType || '—'}</dd>
          </div>
          <div>
            <dt className="text-foreground font-semibold">Topic</dt>
            <dd>{topicDisplay}</dd>
          </div>
          <div>
            <dt className="text-foreground font-semibold">Setting</dt>
            <dd>{settingDisplay}</dd>
          </div>
          <div>
            <dt className="text-foreground font-semibold">Mood</dt>
            <dd>{config.mood || '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

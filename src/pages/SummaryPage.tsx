import { TranscriptActions } from '@/features/conversation/TranscriptActions';
import { useParticipantsMap } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';

export default function SummaryPage() {
  const messages = useSessionStore((state) => state.messages);
  const config = useSessionStore((state) => state.config);
  const participants = useParticipantsMap();
  const topicDisplay = config.topic?.trim() || 'anything';
  const settingDisplay = config.setting?.trim() || 'anywhere';

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Summary</p>
        <h1 className="text-3xl font-semibold text-foreground">Conversation summary</h1>
        <p className="text-base text-muted">
          Review the session details, export the transcript, or jump back to configuration to start
          a new run.
        </p>
      </header>

      <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Transcript
            </h2>
            <p className="mt-1 text-sm text-muted">
              {messages.length
                ? 'Messages below reflect the last conversation session.'
                : 'Run a conversation to populate a transcript.'}
            </p>
          </div>
          <TranscriptActions />
        </div>
        <div className="mt-6 max-h-[50vh] overflow-y-auto rounded-2xl border border-border bg-surface/70 p-4">
          {messages.length ? (
            <ol className="space-y-3 text-sm text-foreground">
              {messages.map((message) => (
                <li key={message.id}>
                  <span className="font-semibold text-foreground">
                    {message.speakerId ? participants.get(message.speakerId)?.displayName ?? 'Narrator' : 'Narrator'}
                  </span>
                  : {message.content}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No transcript available yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Configuration</h2>
        <dl className="mt-4 grid gap-4 text-sm text-muted md:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Type</dt>
            <dd>{config.conversationType || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Topic</dt>
            <dd>{topicDisplay}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Setting</dt>
            <dd>{settingDisplay}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Mood</dt>
            <dd>{config.mood || '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

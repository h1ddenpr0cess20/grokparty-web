import { ConversationControls } from '@/features/conversation/ConversationControls';
import { ConversationTranscript } from '@/features/conversation/ConversationTranscript';
import { TranscriptActions } from '@/features/conversation/TranscriptActions';
import { useSessionStore } from '@/state/sessionStore';

/** Main run screen showing controls, transcript and session details. */
export default function ConversationPage() {
  const config = useSessionStore((state) => state.config);
  const topicDisplay = config.topic?.trim() || 'anything';
  const settingDisplay = config.setting?.trim() || 'anywhere';

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Live conversation</p>
        <p className="text-base text-muted">
          Launch the conversation to watch participants trade messages in real time. Pause, resume,
          and stop at any point.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="flex flex-col gap-4">
          <ConversationControls />
          <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-card">
            <TranscriptActions />
            <ConversationTranscript />
          </div>
        </div>
        <aside className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Session details
          </h2>
          <dl className="space-y-3 text-sm text-muted">
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
            <div>
              <dt className="font-semibold text-foreground">Participants</dt>
              <dd>
                <ul className="space-y-1">
                  {config.participants.map((participant) => (
                    <li key={participant.id} className="flex items-center gap-2">
                      <span
                        className="inline-flex size-2 rounded-full"
                        style={{ backgroundColor: participant.color }}
                        aria-hidden
                      />
                      <span>{participant.displayName}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </section>
  );
}

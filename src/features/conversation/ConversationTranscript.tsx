import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useConversationMessages, useParticipantsMap } from '@/state/sessionSelectors';

/**
 * Live transcript view that auto-scrolls as new messages stream in.
 */
export function ConversationTranscript() {
  const messages = useConversationMessages();
  const participants = useParticipantsMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages.length ? messages[messages.length - 1] : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    const targetTop = lastMessage ? el.scrollHeight : 0;

    el.scrollTo({ top: targetTop, behavior });
  }, [lastMessage?.id, lastMessage?.content, lastMessage?.status, messages.length]);

  return (
    <div ref={containerRef} className="transcript-scroll max-h-[60vh] min-h-[18rem] overflow-y-auto pr-1">
      <ol className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <li>
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted">
              Transcript will appear here once the conversation begins.
            </div>
          </li>
        ) : (
          messages.map((message) => {
            const participant = message.speakerId ? participants.get(message.speakerId) : null;
            const name = participant?.displayName ?? 'Narrator';
            const color = participant?.color ?? '#334155';
            const isPendingStatus = message.status === 'pending' || message.status === 'streaming';
            const showStatus = message.status !== 'completed';
            const formattedStatus = isPendingStatus ? null : formatStatus(message.status);
            const isPendingContent = !message.content;
            return (
              <li key={message.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="inline-flex size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    {name}
                  </span>
                  {showStatus
                    ? isPendingStatus
                      ? <PendingSpinner withLabel={false} />
                      : (
                          <span className="text-xs uppercase tracking-wide text-muted">{formattedStatus}</span>
                        )
                    : null}
                </div>
                <p
                  className={clsx(
                    'mt-3 whitespace-pre-wrap text-sm',
                    isPendingContent ? 'text-muted' : 'text-foreground',
                  )}
                >
                  {message.content}
                </p>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

function PendingSpinner({ withLabel = true }: { withLabel?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-muted',
        withLabel ? 'gap-3' : 'gap-1',
      )}
    >
      <span
        className={clsx('inline-flex items-center', withLabel ? 'gap-1' : 'gap-0.5')}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-2.5 w-2.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: `${index * 0.15}s` }}
            aria-hidden
          />
        ))}
      </span>
      {withLabel ? (
        <span className="text-xs font-semibold uppercase tracking-wide">Typing</span>
      ) : null}
      <span className="sr-only">Waiting for response</span>
    </span>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

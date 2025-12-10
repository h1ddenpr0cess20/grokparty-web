import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useConversationMessages, useParticipantsMap } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

/**
 * Live transcript view that auto-scrolls as new messages stream in.
 */
export function ConversationTranscript() {
  const messages = useConversationMessages();
  const participants = useParticipantsMap();
  const userDisplayName = useSessionStore((state) => state.config.userName?.trim() || 'User');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const lastMessageKey = lastMessage
    ? `${lastMessage.id}:${lastMessage.status}:${lastMessage.content}`
    : 'none';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    const targetTop = lastMessage ? el.scrollHeight : 0;

    el.scrollTo({ top: targetTop, behavior });
  }, [lastMessageKey, lastMessage, messages.length]);

  return (
    <div ref={containerRef} className="transcript-scroll max-h-[60vh] min-h-72 overflow-y-auto pr-1">
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
            const isUserMessage = message.role === 'user';
            const name = isUserMessage ? userDisplayName : participant?.displayName ?? 'Narrator';
            const color = isUserMessage ? '#2563eb' : participant?.color ?? '#334155';
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
                  <div className="flex items-center gap-2">
                    {showStatus
                      ? isPendingStatus
                        ? <PendingSpinner withLabel={false} />
                        : (
                            <span className="text-xs uppercase tracking-wide text-muted">{formattedStatus}</span>
                          )
                      : null}
                    <CopyButton content={message.content ?? ''} disabled={isPendingContent} />
                  </div>
                </div>
                <MarkdownMessage content={message.content} isPending={isPendingContent} />
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

function MarkdownMessage({ content, isPending }: { content: string; isPending: boolean }) {
  return (
    <div
      className={clsx(
        'markdown-body mt-3 text-sm',
        isPending ? 'text-muted' : 'text-foreground',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  children?: ReactNode;
};

const MarkdownCodeBlock = ({ inline, className, children, ...props }: MarkdownCodeProps) => {
  const baseClass = clsx('font-mono text-xs', className);
  if (!inline) {
    return (
      <pre className="overflow-x-auto rounded-xl bg-border/20 p-4">
        <code className={baseClass} {...props}>
          {children}
        </code>
      </pre>
    );
  }
  return (
    <code className={clsx('rounded-md bg-border/30 px-1.5 py-0.5', baseClass)} {...props}>
      {children}
    </code>
  );
};

const MARKDOWN_COMPONENTS: Components = {
  a: ({ children, ...props }) => (
    <a
      {...props}
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  code: MarkdownCodeBlock,
  img: ({ alt, src }) => {
    if (!src) {
      return null;
    }

    const label = alt?.trim() ?? '';
    const isCitation = label ? /^\d+$/.test(label) : false;

    if (isCitation) {
      return (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="citation-link"
        >
          [{label}]
        </a>
      );
    }

    return (
      <img src={src} alt={alt ?? ''} className="max-h-80 w-full rounded-xl object-contain" />
    );
  },
};

function CopyButton({ content, disabled }: { content: string; disabled: boolean }) {
  const handleCopy = async () => {
    if (!content || disabled) {
      return;
    }

    const text = content;
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

    if (!clipboard?.writeText) {
      showToast({
        variant: 'warning',
        description: 'Clipboard access is unavailable. Please copy the message manually.',
        durationMs: 5000,
      });
      return;
    }

    try {
      await clipboard.writeText(text);
      showToast({ variant: 'success', description: 'Message copied to clipboard.' });
    } catch (error) {
      const details = error instanceof Error ? ` ${error.message}` : '';
      showToast({
        variant: 'danger',
        description: `Unable to copy the message.${details ? ` (${details})` : ''}`,
        durationMs: 5000,
      });
    }
  };

  return (
    <button
      type="button"
      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
      aria-label={disabled ? 'Message not ready to copy yet' : 'Copy message to clipboard'}
      title={disabled ? 'Message not ready to copy yet' : 'Copy message to clipboard'}
      onClick={handleCopy}
      disabled={disabled}
    >
      <CopyIcon className="size-4" />
    </button>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="9" y="9" width="10" height="12" rx="2" ry="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
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
            className="size-2.5 animate-bounce rounded-full bg-current"
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

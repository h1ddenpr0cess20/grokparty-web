import {
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import tsxLang from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import tsLang from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsLang from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bashLang from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import shellLang from 'react-syntax-highlighter/dist/esm/languages/prism/shell-session';
import pythonLang from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import htmlLang from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import cssLang from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdownLang from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import yamlLang from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import goLang from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rustLang from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import { useConversationMessages, useParticipantsMap } from '@/state/sessionSelectors';
import { useSessionStore, type ConversationMessage } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

SyntaxHighlighter.registerLanguage('tsx', tsxLang);
SyntaxHighlighter.registerLanguage('ts', tsLang);
SyntaxHighlighter.registerLanguage('typescript', tsLang);
SyntaxHighlighter.registerLanguage('javascript', jsLang);
SyntaxHighlighter.registerLanguage('js', jsLang);
SyntaxHighlighter.registerLanguage('json', jsonLang);
SyntaxHighlighter.registerLanguage('bash', bashLang);
SyntaxHighlighter.registerLanguage('sh', shellLang);
SyntaxHighlighter.registerLanguage('shell', shellLang);
SyntaxHighlighter.registerLanguage('shell-session', shellLang);
SyntaxHighlighter.registerLanguage('python', pythonLang);
SyntaxHighlighter.registerLanguage('py', pythonLang);
SyntaxHighlighter.registerLanguage('html', htmlLang);
SyntaxHighlighter.registerLanguage('markup', htmlLang);
SyntaxHighlighter.registerLanguage('css', cssLang);
SyntaxHighlighter.registerLanguage('md', markdownLang);
SyntaxHighlighter.registerLanguage('markdown', markdownLang);
SyntaxHighlighter.registerLanguage('yaml', yamlLang);
SyntaxHighlighter.registerLanguage('yml', yamlLang);
SyntaxHighlighter.registerLanguage('go', goLang);
SyntaxHighlighter.registerLanguage('rust', rustLang);

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
                <MarkdownMessage content={message.content} status={message.status} />
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

function MarkdownMessage({
  content,
  status,
}: {
  content: string;
  status: ConversationMessage['status'];
}) {
  const isPending = !content;
  const highlightEnabled = status === 'completed';
  const components = useMemo(() => createMarkdownComponents({ highlightEnabled }), [highlightEnabled]);

  return (
    <div
      className={clsx(
        'markdown-body mt-3 text-sm',
        isPending ? 'text-muted' : 'text-foreground',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  children?: ReactNode;
  highlightEnabled: boolean;
};

const MarkdownCode = ({ inline, className, children, highlightEnabled, ...props }: MarkdownCodeProps) => {
  const codeText = useMemo(() => extractCodeText(children), [children]);
  const language = useMemo(() => {
    if (!className) {
      return undefined;
    }
    const match = className.match(/language-([\w-]+)/);
    return match?.[1];
  }, [className]);

  if (inline) {
    return (
      <code className={clsx('rounded-md bg-border/30 px-1.5 py-0.5 font-mono text-xs', className)} {...props}>
        {children}
      </code>
    );
  }

  if (!highlightEnabled) {
    return (
      <pre style={CODE_BLOCK_STYLE}>
        <code className="font-mono text-xs whitespace-pre-wrap" {...props}>
          {codeText}
        </code>
      </pre>
    );
  }

  return (
    <div className="relative">
      <SyntaxHighlighter
        language={language ?? 'text'}
        style={PRISM_SYNTAX_THEME}
        customStyle={CODE_BLOCK_STYLE}
        wrapLongLines
        PreTag="pre"
        codeTagProps={{ className: 'font-mono text-xs' }}
      >
        {codeText}
      </SyntaxHighlighter>
      {codeText ? <CopyCodeButton content={codeText} /> : null}
    </div>
  );
};

function createMarkdownComponents({ highlightEnabled }: { highlightEnabled: boolean }): Components {
  return {
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
    code: (props) => <MarkdownCode {...props} highlightEnabled={highlightEnabled} />,
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
}

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

function CopyCodeButton({ content }: { content: string }) {
  if (!content) {
    return null;
  }
  return (
    <div className="absolute right-3 top-3">
      <CopyButton content={content} disabled={false} />
    </div>
  );
}

type PrismTheme = Record<string, CSSProperties>;

const CODE_BLOCK_STYLE: CSSProperties = {
  background: 'hsl(var(--color-border) / 0.18)',
  borderRadius: '1rem',
  margin: 0,
  padding: '1rem',
  overflowX: 'auto',
};

const PRISM_SYNTAX_THEME: PrismTheme = {
  'code[class*="language-"]': {
    color: 'hsl(var(--color-foreground))',
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: '0.85rem',
    textShadow: 'none',
  },
  'pre[class*="language-"]': {
    color: 'inherit',
    margin: 0,
    border: 'none',
    background: 'transparent',
    textShadow: 'none',
  },
  comment: { color: 'hsl(var(--color-muted))', fontStyle: 'italic' },
  prolog: { color: 'hsl(var(--color-muted))' },
  cdata: { color: 'hsl(var(--color-muted))' },
  punctuation: { color: 'hsl(var(--color-foreground) / 0.9)' },
  'attr-name': { color: '#f59e0b' },
  'class-name': { color: '#facc15' },
  boolean: { color: '#f97316' },
  constant: { color: '#f97316' },
  number: { color: '#f97316' },
  keyword: { color: '#a855f7', fontWeight: 600 },
  operator: { color: '#c084fc' },
  property: { color: '#38bdf8' },
  tag: { color: '#fb7185' },
  symbol: { color: '#fb7185' },
  deleted: { color: '#fb7185' },
  selector: { color: '#34d399' },
  string: { color: '#4ade80' },
  char: { color: '#4ade80' },
  builtin: { color: '#2dd4bf' },
  inserted: { color: '#2dd4bf' },
  regex: { color: '#f97316' },
  important: { color: '#f472b6' },
  variable: { color: '#38bdf8' },
  function: { color: '#0ea5e9' },
  url: { color: '#22d3ee' },
};

function extractCodeText(children: ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map((child) => extractCodeText(child)).join('');
  }
  if (isValidElement(children)) {
    const element = children as ReactElement<{ children?: ReactNode }>;
    return extractCodeText(element.props.children);
  }
  if (typeof children === 'number') {
    return children.toString();
  }
  return '';
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

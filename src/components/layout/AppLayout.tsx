import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ApiKeyMenu } from '@/components/layout/ApiKeyMenu';
import { useSessionStore } from '@/state/sessionStore';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/setup', label: 'Setup' },
  { to: '/conversation', label: 'Conversation' },
];

export function AppLayout() {
  const status = useSessionStore((state) => state.status);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            GrokParty
          </NavLink>
          <nav className="hidden items-center gap-3 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-surface/60',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <ApiKeyMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 bg-surface/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between p-4 text-xs text-muted">
          <span>© {new Date().getFullYear()} GrokParty</span>
          <span>Built with Vite + React</span>
        </div>
      </footer>
    </div>
  );
}

type StatusMeta = { label: string; tone: string };

const STATUS_META: Record<string, StatusMeta> = {
  streaming: { label: 'Streaming', tone: 'bg-success/10 text-success' },
  paused: { label: 'Paused', tone: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', tone: 'bg-secondary/10 text-secondary' },
  connecting: { label: 'Connecting', tone: 'bg-primary/10 text-primary' },
  error: { label: 'Error', tone: 'bg-danger/10 text-danger' },
  ready: { label: 'Ready', tone: 'bg-primary/10 text-primary' },
  configuring: { label: 'Configuring', tone: 'bg-muted/15 text-muted' },
};

const DEFAULT_STATUS_META: StatusMeta = { label: 'Idle', tone: 'bg-muted/15 text-muted' };

function StatusPill({ status }: { status: string }) {
  const { label, tone } = getStatusMeta(status);
  return (
    <span
      data-testid="session-status"
      className={clsx(
        'hidden rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide md:inline-flex',
        tone,
      )}
    >
      {label}
    </span>
  );
}

function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? DEFAULT_STATUS_META;
}

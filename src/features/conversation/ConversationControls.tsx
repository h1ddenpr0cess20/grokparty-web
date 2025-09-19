import { Button } from '@/components/ui/Button';
import { useConversationEngine } from './useConversationEngine';
import { useSessionStatus } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

export function ConversationControls() {
  const status = useSessionStatus();
  const setStatus = useSessionStore((state) => state.setStatus);
  const setError = useSessionStore((state) => state.setError);
  const { start, pause, resume, stop } = useConversationEngine();

  const handleStart = async () => {
    try {
      await start();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Missing configuration or API key.';
      showToast({
        variant: 'danger',
        title: 'Cannot start conversation',
        description: message,
        durationMs: 5000,
      });
      setError(message);
      setStatus('error');
    }
  };

  const running = status === 'streaming' || status === 'paused' || status === 'connecting';
  const paused = status === 'paused';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={handleStart} disabled={running}>
        {running ? 'Running…' : 'Start conversation'}
      </Button>
      <Button variant="secondary" onClick={() => (paused ? resume() : pause())} disabled={!running}>
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button variant="ghost" onClick={() => stop()} disabled={!running}>
        Stop
      </Button>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{status}</span>
    </div>
  );
}

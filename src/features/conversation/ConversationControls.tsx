import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useConversationEngine } from './useConversationEngine';
import { useSessionStatus } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

/**
 * Primary controls for starting, pausing/resuming and stopping a session run.
 */
export function ConversationControls() {
  const status = useSessionStatus();
  const setStatus = useSessionStore((state) => state.setStatus);
  const setError = useSessionStore((state) => state.setError);
  const { start, pause, resume, stop, interject, cancelInterjection } = useConversationEngine();
  const [interjecting, setInterjecting] = useState(false);
  const [interjectionDraft, setInterjectionDraft] = useState('');

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

  useEffect(() => {
    if (status === 'idle' || status === 'completed' || status === 'error') {
      setInterjecting(false);
      setInterjectionDraft('');
    }
  }, [status]);

  const running = status === 'streaming' || status === 'paused' || status === 'connecting';
  const paused = status === 'paused';
  const waitingForPause = interjecting && !paused;
  const canSendInterjection = interjecting && paused && interjectionDraft.trim().length > 0;

  const handleInterject = () => {
    if (!running || interjecting) {
      return;
    }
    setInterjecting(true);
    setInterjectionDraft('');
    if (!paused) {
      pause();
    }
  };

  const handleSendInterjection = () => {
    if (!interjecting || !paused) {
      return;
    }
    const trimmed = interjectionDraft.trim();
    if (!trimmed) {
      return;
    }
    interject(trimmed);
    setInterjecting(false);
    setInterjectionDraft('');
  };

  const handleCancelInterjection = () => {
    if (!interjecting) {
      return;
    }
    setInterjecting(false);
    setInterjectionDraft('');
    cancelInterjection();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleStart} disabled={running}>
          {running ? 'Running…' : 'Start conversation'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => (paused ? resume() : pause())}
          disabled={!running || interjecting}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="secondary" onClick={handleInterject} disabled={!running || interjecting}>
          Interject
        </Button>
        <Button variant="ghost" onClick={() => stop()} disabled={!running}>
          Stop
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{status}</span>
      </div>

      {interjecting ? (
        <div className="w-full rounded-2xl border border-border bg-surface/60 p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Your interjection
            </span>
            <Textarea
              rows={3}
              value={interjectionDraft}
              onChange={(event) => setInterjectionDraft(event.target.value)}
              placeholder="Add your message"
              disabled={!running}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSendInterjection} disabled={!canSendInterjection}>
                Send
              </Button>
              <Button variant="ghost" onClick={handleCancelInterjection}>
                Cancel
              </Button>
              {waitingForPause ? (
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Waiting for pause…
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/state/sessionStore';

export function TranscriptActions() {
  const messages = useSessionStore((state) => state.messages);
  const config = useSessionStore((state) => state.config);

  const handleDownload = () => {
    const payload = {
      config,
      messages,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `grokparty-transcript-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" type="button" onClick={handleDownload} disabled={!messages.length}>
        Download transcript
      </Button>
    </div>
  );
}

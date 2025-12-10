import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useParticipantsMap } from '@/state/sessionSelectors';
import { useSessionStore } from '@/state/sessionStore';
import {
  buildTranscriptExport,
  TRANSCRIPT_EXPORT_OPTIONS,
  type TranscriptExportFormat,
} from './transcriptExport';

/**
 * Actions for exporting the current transcript with configuration metadata.
 */
export function TranscriptActions() {
  const messages = useSessionStore((state) => state.messages);
  const config = useSessionStore((state) => state.config);
  const participants = useParticipantsMap();
  const [format, setFormat] = useState<TranscriptExportFormat>('json');

  const handleDownload = () => {
    const exportResult = buildTranscriptExport({
      format,
      config,
      messages,
      participants,
      exportedAt: new Date(),
    });
    const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `grokparty-transcript-${Date.now()}.${exportResult.extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="transcript-format" className="sr-only">
        Transcript format
      </label>
      <select
        id="transcript-format"
        aria-label="Transcript format"
        className="rounded-full border border-border bg-surface/80 px-3 py-2 text-sm text-foreground shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        value={format}
        onChange={(event) => setFormat(event.target.value as TranscriptExportFormat)}
      >
        {TRANSCRIPT_EXPORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button variant="secondary" type="button" onClick={handleDownload} disabled={!messages.length}>
        Download transcript
      </Button>
    </div>
  );
}

import type { ConversationConfig, ConversationMessage, Participant } from '@/state/sessionStore';

export const TRANSCRIPT_EXPORT_OPTIONS = [
  { value: 'json', label: 'JSON (.json)' },
  { value: 'markdown', label: 'Markdown (.md)' },
  { value: 'html', label: 'HTML (.html)' },
  { value: 'text', label: 'Plain text (.txt)' },
] as const;

export type TranscriptExportFormat = (typeof TRANSCRIPT_EXPORT_OPTIONS)[number]['value'];

const FORMAT_DETAILS: Record<TranscriptExportFormat, { mimeType: string; extension: string }> = {
  json: { mimeType: 'application/json', extension: 'json' },
  markdown: { mimeType: 'text/markdown', extension: 'md' },
  html: { mimeType: 'text/html', extension: 'html' },
  text: { mimeType: 'text/plain', extension: 'txt' },
};

interface BuildTranscriptExportParams {
  format: TranscriptExportFormat;
  config: ConversationConfig;
  messages: ConversationMessage[];
  participants: Map<string, Participant>;
  exportedAt: Date;
}

export interface TranscriptExportResult {
  content: string;
  mimeType: string;
  extension: string;
}

type TranscriptTemplateArgs = [
  ConversationConfig,
  ConversationMessage[],
  Map<string, Participant>,
  Date,
];

/**
 * Builds the formatted payload for the requested export format.
 */
export function buildTranscriptExport({
  format,
  config,
  messages,
  participants,
  exportedAt,
}: BuildTranscriptExportParams): TranscriptExportResult {
  const base = FORMAT_DETAILS[format];

  switch (format) {
    case 'json':
      return {
        ...base,
        content: JSON.stringify(
          {
            config,
            messages,
            exportedAt: exportedAt.toISOString(),
          },
          null,
          2,
        ),
      };
    case 'markdown':
      return {
        ...base,
        content: formatAsMarkdown(config, messages, participants, exportedAt),
      };
    case 'html':
      return {
        ...base,
        content: formatAsHtml(config, messages, participants, exportedAt),
      };
    default:
      return {
        ...base,
        content: formatAsText(config, messages, participants, exportedAt),
      };
  }
}

function formatAsMarkdown(...[config, messages, participants, exportedAt]: TranscriptTemplateArgs) {
  const metadataLines = [
    '# GrokParty Transcript',
    '',
    `- **Exported:** ${exportedAt.toISOString()}`,
    `- **Conversation Type:** ${formatDisplayValue(config.conversationType)}`,
    `- **Topic:** ${formatDisplayValue(config.topic)}`,
    `- **Setting:** ${formatDisplayValue(config.setting)}`,
    `- **Mood:** ${formatDisplayValue(config.mood)}`,
    `- **Host:** ${formatDisplayValue(config.userName)}`,
    `- **Decision Model:** ${formatDisplayValue(config.decisionModel)}`,
  ];

  const participantLines = config.participants.length
    ? config.participants.map(
        (participant, index) =>
          `${index + 1}. **${participant.displayName}** – ${participant.model} (Temp: ${formatTemperature(
            participant.temperature,
          )}, Search: ${formatBooleanDisplay(participant.enableSearch)})`,
      )
    : ['_No participants recorded._'];

  const transcriptLines = messages.length
    ? messages.map((message) => {
        const speaker = getSpeakerLabel(message, participants);
        const content = message.content?.trim() ?? '';
        return `- **${speaker}:** ${content || '—'}`;
      })
    : ['_No messages recorded._'];

  return [
    ...metadataLines,
    '',
    '## Participants',
    '',
    ...participantLines,
    '',
    '## Transcript',
    '',
    ...transcriptLines,
    '',
  ].join('\n');
}

function formatAsText(...[config, messages, participants, exportedAt]: TranscriptTemplateArgs) {
  const metadata = [
    'GrokParty Transcript',
    `Exported: ${exportedAt.toISOString()}`,
    `Conversation Type: ${formatDisplayValue(config.conversationType)}`,
    `Topic: ${formatDisplayValue(config.topic)}`,
    `Setting: ${formatDisplayValue(config.setting)}`,
    `Mood: ${formatDisplayValue(config.mood)}`,
    `Host: ${formatDisplayValue(config.userName)}`,
    `Decision Model: ${formatDisplayValue(config.decisionModel)}`,
  ];

  const participantLines = config.participants.length
    ? config.participants.map(
        (participant, index) =>
          `${index + 1}. ${participant.displayName} – ${participant.model} (Temp: ${formatTemperature(
            participant.temperature,
          )}, Search: ${formatBooleanDisplay(participant.enableSearch)})`,
      )
    : ['No participants recorded.'];

  const transcriptLines = messages.length
    ? messages.map((message) => {
        const speaker = getSpeakerLabel(message, participants);
        const content = message.content?.trim() ?? '';
        return `${speaker}: ${content || '—'}`;
      })
    : ['No messages recorded.'];

  return [
    ...metadata,
    '',
    'Participants:',
    ...participantLines,
    '',
    'Transcript:',
    ...transcriptLines,
    '',
  ].join('\n');
}

function formatAsHtml(...[config, messages, participants, exportedAt]: TranscriptTemplateArgs) {
  const metadataEntries = [
    { label: 'Exported', value: exportedAt.toISOString() },
    { label: 'Conversation Type', value: formatDisplayValue(config.conversationType) },
    { label: 'Topic', value: formatDisplayValue(config.topic) },
    { label: 'Setting', value: formatDisplayValue(config.setting) },
    { label: 'Mood', value: formatDisplayValue(config.mood) },
    { label: 'Host', value: formatDisplayValue(config.userName) },
    { label: 'Decision Model', value: formatDisplayValue(config.decisionModel) },
  ];

  const metadataList = metadataEntries
    .map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</li>`)
    .join('\n            ');

  const participantList = config.participants.length
    ? `<ol class="participants-list">
            ${config.participants
              .map(
                (participant, index) =>
                  `<li><strong>${index + 1}. ${escapeHtml(participant.displayName)}</strong> – ${escapeHtml(
                    participant.model,
                  )} (Temp: ${escapeHtml(
                    formatTemperature(participant.temperature),
                  )}, Search: ${escapeHtml(formatBooleanDisplay(participant.enableSearch))})</li>`,
              )
              .join('\n            ')}
          </ol>`
    : '<p><em>No participants recorded.</em></p>';

  const transcriptList = messages.length
    ? `<ul class="transcript-list">
            ${messages
              .map((message) => {
                const speaker = getSpeakerLabel(message, participants);
                const content = message.content?.trim() || '—';
                return `<li><strong>${escapeHtml(speaker)}:</strong> ${escapeHtml(content)}</li>`;
              })
              .join('\n            ')}
          </ul>`
    : '<p><em>No messages recorded.</em></p>';

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>GrokParty Transcript</title>',
    '  <style>',
    '    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; margin: 2rem; background: #f9fafb; color: #0f172a; }',
    '    h1 { margin-bottom: 1rem; }',
    '    section { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; }',
    '    ul, ol { padding-left: 1.5rem; }',
    '    .metadata-list strong { color: #0f172a; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <h1>GrokParty Transcript</h1>',
    '    <section>',
    '      <h2>Session details</h2>',
    '      <ul class="metadata-list">',
    `        ${metadataList}`,
    '      </ul>',
    '    </section>',
    '    <section>',
    '      <h2>Participants</h2>',
    `      ${participantList}`,
    '    </section>',
    '    <section>',
    '      <h2>Transcript</h2>',
    `      ${transcriptList}`,
    '    </section>',
    '  </main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function formatDisplayValue(value?: string | null) {
  if (!value) {
    return '—';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : '—';
}

function formatTemperature(value?: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return normalized;
  }
  return '—';
}

function formatBooleanDisplay(enabled: boolean) {
  return enabled ? 'Enabled' : 'Disabled';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSpeakerLabel(message: ConversationMessage, participants: Map<string, Participant>) {
  if (!message.speakerId) {
    return 'Narrator';
  }
  return participants.get(message.speakerId)?.displayName ?? 'Narrator';
}

import type { ConversationConfig, ConversationMessage, Participant, McpServerConfig } from '@/state/sessionStore';

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
    ? config.participants.map((participant, index) => {
        const extras = [
          `Temp: ${formatTemperature(participant.temperature)}`,
          `Search: ${formatBooleanDisplay(participant.enableSearch)}`,
        ];
        const mcpSummary = describeParticipantMcpAccess(participant, config.mcpServers);
        if (mcpSummary) {
          extras.push(`MCP: ${mcpSummary}`);
        }
        return `${index + 1}. **${participant.displayName}** – ${participant.model} (${extras.join(', ')})`;
      })
    : ['_No participants recorded._'];

  const mcpServerLines = config.mcpServers.length
    ? config.mcpServers.map((server, index) => `${index + 1}. **${server.label || 'Untitled'}** – ${server.url}`)
    : [];

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
    ...(mcpServerLines.length
      ? ['## MCP Servers', '', ...mcpServerLines, '']
      : []),
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
    ? config.participants.map((participant, index) => {
        const extras = [
          `Temp: ${formatTemperature(participant.temperature)}`,
          `Search: ${formatBooleanDisplay(participant.enableSearch)}`,
        ];
        const mcpSummary = describeParticipantMcpAccess(participant, config.mcpServers);
        if (mcpSummary) {
          extras.push(`MCP: ${mcpSummary}`);
        }
        return `${index + 1}. ${participant.displayName} – ${participant.model} (${extras.join(', ')})`;
      })
    : ['No participants recorded.'];

  const mcpServerLines = config.mcpServers.length
    ? config.mcpServers.map((server, index) => `${index + 1}. ${server.label || 'Untitled'} – ${server.url}`)
    : [];

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
    ...(mcpServerLines.length
      ? ['', 'MCP Servers:', ...mcpServerLines]
      : []),
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
              .map((participant, index) => {
                const extras = [
                  `Temp: ${formatTemperature(participant.temperature)}`,
                  `Search: ${formatBooleanDisplay(participant.enableSearch)}`,
                ];
                const mcpSummary = describeParticipantMcpAccess(participant, config.mcpServers);
                if (mcpSummary) {
                  extras.push(`MCP: ${mcpSummary}`);
                }
                return `<li><strong>${index + 1}. ${escapeHtml(participant.displayName)}</strong> – ${escapeHtml(
                  participant.model,
                )} (${escapeHtml(extras.join(', '))})</li>`;
              })
              .join('\n            ')}
          </ol>`
    : '<p><em>No participants recorded.</em></p>';

  const mcpServersList = config.mcpServers.length
    ? `<ol class="mcp-list">
            ${config.mcpServers
              .map((server, index) => `<li><strong>${index + 1}. ${escapeHtml(server.label || 'Untitled')}</strong> – ${escapeHtml(server.url)}</li>`)
              .join('\n            ')}
          </ol>`
    : '<p><em>No MCP servers configured.</em></p>';

  const transcriptList = messages.length
    ? `<ul class="transcript-list">
            ${messages
              .map((message) => {
                const speaker = getSpeakerLabel(message, participants);
                const content = renderHtmlMessageContent(message.content);
                return `<li><div class="message-card"><p class="message-speaker"><strong>${escapeHtml(
                  speaker,
                )}</strong></p>${content}</div></li>`;
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
    '    :root { color-scheme: light dark; }',
    '    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; margin: clamp(1.5rem, 4vw, 3.5rem); background: #f9fafb; color: #0f172a; }',
    '    h1 { margin-bottom: 1rem; }',
    '    section { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; }',
    '    ul, ol { padding-left: 1.5rem; margin-top: 0.5rem; }',
    '    .metadata-list strong { color: #0f172a; }',
    '    .message-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }',
    '    .message-speaker { margin: 0 0 0.5rem 0; color: #0f172a; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; }',
    '    .message-content p { margin: 0.4rem 0; }',
    '    pre { background: #0f172a; color: #f1f5f9; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.85rem; line-height: 1.45; }',
    '    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }',
    '    blockquote { border-left: 4px solid #cbd5f5; margin: 0.8rem 0; padding-left: 1rem; color: #475569; }',
    '    @media (prefers-color-scheme: dark) {',
    '      body { background: #020617; color: #e2e8f0; }',
    '      section { border-color: #1e293b; }',
    '      .message-card { background: #0f172a; border-color: #1e293b; box-shadow: 0 8px 16px rgba(2, 6, 23, 0.5); }',
    '      .message-speaker { color: #e2e8f0; }',
    '      .metadata-list strong { color: #e2e8f0; }',
    '      blockquote { border-left-color: #475569; color: #94a3b8; }',
    '    }',
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
    '      <h2>MCP servers</h2>',
    `      ${mcpServersList}`,
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

function describeParticipantMcpAccess(participant: Participant, servers: McpServerConfig[]) {
  if (!participant.mcpAccess?.length || !servers.length) {
    return '';
  }
  const serverMap = new Map(servers.map((server) => [server.id, server]));
  const segments = participant.mcpAccess
    .map((access) => {
      const server = serverMap.get(access.serverId);
      if (!server) {
        return null;
      }
      const suffix = access.allowedToolNames?.length
        ? ` (tools: ${access.allowedToolNames.join(', ')})`
        : '';
      return `${server.label}${suffix}`;
    })
    .filter(Boolean);

  return segments.length ? segments.join('; ') : '';
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

function renderHtmlMessageContent(content?: string | null) {
  if (!content) {
    return '<p class="message-content">—</p>';
  }

  const segments = content.split(/(```[\s\S]*?```)/g);

  const rendered = segments
    .map((segment) => {
      const codeMatch = segment.match(/^```(\w+)?\n([\s\S]*?)```$/);
      if (codeMatch) {
        const language = codeMatch[1]?.trim() ?? '';
        const codeBody = codeMatch[2] ?? '';
        return `<div class="message-content"><pre><code class="language-${escapeHtml(language)}">${escapeHtml(
          codeBody,
        )}</code></pre></div>`;
      }

      if (!segment.trim()) {
        return '';
      }

      return `<p class="message-content">${escapeHtml(segment.trim())}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return rendered || '<p class="message-content">—</p>';
}

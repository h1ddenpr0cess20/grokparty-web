import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TranscriptActions } from './TranscriptActions';
import { buildTranscriptExport } from './transcriptExport';
import { resetSessionStore } from '@/test/testUtils';
import { useSessionStore, createEmptyMessage, type ConversationConfig, type Participant } from '@/state/sessionStore';

describe('TranscriptActions', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('disables download when there are no messages', () => {
    render(<TranscriptActions />);
    expect(screen.getByRole('button', { name: /download transcript/i })).toBeDisabled();
  });

  it('downloads transcript JSON when messages exist', () => {
    const store = useSessionStore.getState();
    store.appendMessage(
      createEmptyMessage({ id: 'msg-1', speakerId: 'p1', content: 'Hello there', status: 'completed' }),
    );

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});

    render(<TranscriptActions />);

    const button = screen.getByRole('button', { name: /download transcript/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('buildTranscriptExport', () => {
  const baseConfig: ConversationConfig = {
    conversationType: 'panel',
    topic: 'AI and society',
    setting: 'Conference stage',
    mood: 'lively',
    userName: 'Host',
    decisionModel: 'grok-4',
    mcpServers: [
      { id: 'srv-1', label: 'DeepWiki', url: 'https://mcp.deepwiki.com/mcp' },
      { id: 'srv-2', label: 'ToolRack', url: 'https://mcp.toolrack.dev/mcp' },
    ],
    participants: [
      {
        id: 'p1',
        displayName: 'Ada',
        persona: 'Ada persona',
        model: 'grok-4',
        color: '#fff',
        temperature: 0.75,
        enableSearch: true,
        enableCodeInterpreter: true,
        enableXSearchTool: true,
        mcpAccess: [
          { serverId: 'srv-1', allowedToolNames: ['search_docs'] },
        ],
      },
      {
        id: 'p2',
        displayName: 'Lin',
        persona: 'Lin persona',
        model: 'grok-3',
        color: '#000',
        temperature: 0.65,
        enableSearch: false,
        enableCodeInterpreter: false,
        enableXSearchTool: false,
        mcpAccess: [
          { serverId: 'srv-2', allowedToolNames: [] },
        ],
      },
    ],
  };

  const participantsMap = new Map<string, Participant>(
    baseConfig.participants.map((participant) => [participant.id, participant]),
  );

  const messages = [
    createEmptyMessage({
      id: 'msg-1',
      speakerId: 'p1',
      content: 'Hello world',
      status: 'completed',
    }),
  ];

  const exportedAt = new Date('2024-01-01T00:00:00.000Z');

  it('builds JSON export with metadata bundle', () => {
    const result = buildTranscriptExport({
      format: 'json',
      config: baseConfig,
      messages,
      participants: participantsMap,
      exportedAt,
    });

    expect(result.mimeType).toBe('application/json');
    expect(result.extension).toBe('json');
    const parsed = JSON.parse(result.content);
    expect(parsed.config.conversationType).toBe('panel');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.exportedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('builds markdown export with transcript entries', () => {
    const result = buildTranscriptExport({
      format: 'markdown',
      config: baseConfig,
      messages,
      participants: participantsMap,
      exportedAt,
    });

    expect(result.mimeType).toBe('text/markdown');
    expect(result.extension).toBe('md');
    expect(result.content).toContain('# GrokParty Transcript');
    expect(result.content).toContain('**Conversation Type:** panel');
    expect(result.content).toContain('1. **Ada** – grok-4 (Temp: 0.75, Search: Enabled, Code Interpreter: Enabled, X Search Tool: Enabled, MCP: DeepWiki (tools: search_docs))');
    expect(result.content).toContain('## MCP Servers');
    expect(result.content).toContain('1. **DeepWiki** – https://mcp.deepwiki.com/mcp');
    expect(result.content).toContain('**Ada:** Hello world');
  });

  it('builds plain text export with transcript entries', () => {
    const result = buildTranscriptExport({
      format: 'text',
      config: baseConfig,
      messages,
      participants: participantsMap,
      exportedAt,
    });

    expect(result.mimeType).toBe('text/plain');
    expect(result.extension).toBe('txt');
    expect(result.content).toContain('GrokParty Transcript');
    expect(result.content).toContain('Conversation Type: panel');
    expect(result.content).toContain('1. Ada – grok-4 (Temp: 0.75, Search: Enabled, Code Interpreter: Enabled, X Search Tool: Enabled, MCP: DeepWiki (tools: search_docs))');
    expect(result.content).toContain('MCP Servers:');
    expect(result.content).toContain('Ada: Hello world');
  });

  it('builds HTML export with escaped transcript entries', () => {
    const htmlMessages = [
      ...messages,
      createEmptyMessage({
        id: 'msg-2',
        speakerId: 'p2',
        content: '<script>alert("xss")</script>',
        status: 'completed',
      }),
    ];

    const result = buildTranscriptExport({
      format: 'html',
      config: baseConfig,
      messages: htmlMessages,
      participants: participantsMap,
      exportedAt,
    });

    expect(result.mimeType).toBe('text/html');
    expect(result.extension).toBe('html');
    expect(result.content).toContain('<h1>GrokParty Transcript</h1>');
    expect(result.content).toContain('<strong>Conversation Type:</strong> panel');
    expect(result.content).toContain('<h2>Participants</h2>');
    expect(result.content).toContain('<h2>MCP servers</h2>');
    expect(result.content).toContain('<p class="message-speaker"><strong>Ada</strong></p>');
    expect(result.content).toContain('<p class="message-content">Hello world</p>');
    expect(result.content).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

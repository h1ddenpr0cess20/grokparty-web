import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useSessionStore, type McpServerConfig } from '@/state/sessionStore';
import { useUiStore } from '@/state/uiStore';
import { showToast } from '@/state/toastStore';

type ServerDraft = McpServerConfig;

const MCP_DOCS_URL = 'https://modelcontextprotocol.io/';

export function McpServersMenu() {
  const serversInConfig = useSessionStore((state) => state.config.mcpServers);
  const updateConfig = useSessionStore((state) => state.updateConfig);
  const isMcpMenuOpen = useUiStore((state) => state.isMcpMenuOpen);
  const toggleMcpMenu = useUiStore((state) => state.toggleMcpMenu);
  const closeMcpMenu = useUiStore((state) => state.closeMcpMenu);
  const [servers, setServers] = useState<ServerDraft[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMcpMenuOpen) {
      return;
    }
    setServers(serversInConfig.length ? serversInConfig.map((server) => ({ ...server })) : []);
  }, [isMcpMenuOpen, serversInConfig]);

  useEffect(() => {
    if (!isMcpMenuOpen) {
      return;
    }

    const handlePointer = (event: MouseEvent) => {
      if (!panelRef.current) {
        return;
      }
      if (event.target instanceof Node && !panelRef.current.contains(event.target)) {
        closeMcpMenu();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMcpMenu();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [closeMcpMenu, isMcpMenuOpen]);

  const dirty = useMemo(() => {
    if (servers.length !== serversInConfig.length) {
      return true;
    }
    return servers.some((server, index) => {
      const original = serversInConfig[index];
      return !original || original.label !== server.label || original.url !== server.url;
    });
  }, [servers, serversInConfig]);

  const handleAddServer = () => {
    setServers((prev) => [...prev, createServerDraft()]);
  };

  const handleRemoveServer = (id: string) => {
    setServers((prev) => prev.filter((server) => server.id !== id));
  };

  const handleServerChange = (id: string, patch: Partial<ServerDraft>) => {
    setServers((prev) => prev.map((server) => (server.id === id ? { ...server, ...patch } : server)));
  };

  const handleSave = () => {
    const sanitized = servers
      .map((server) => ({
        ...server,
        label: server.label.trim(),
        url: server.url.trim(),
      }))
      .filter((server) => server.label && server.url);

    if (servers.length && sanitized.length !== servers.length) {
      showToast({
        variant: 'danger',
        title: 'Missing details',
        description: 'Each server needs both a label and URL before saving.',
        durationMs: 4000,
      });
      return;
    }

    try {
      sanitized.forEach((server) => {
        // Throws for invalid URLs.
        new URL(server.url);
      });
    } catch (error) {
      showToast({
        variant: 'danger',
        title: 'Invalid URL',
        description: error instanceof Error ? error.message : 'Enter a valid MCP server URL.',
        durationMs: 4000,
      });
      return;
    }

    updateConfig({
      mcpServers: sanitized,
    });
    showToast({
      variant: 'success',
      title: 'Servers updated',
      description: sanitized.length
        ? 'Characters can now use the configured MCP servers.'
        : 'No MCP servers are configured.',
      durationMs: 3500,
    });
    closeMcpMenu();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleMcpMenu}
        className="flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-surface/80"
      >
        MCP servers
        <span className="text-xs text-muted">{serversInConfig.length}</span>
      </button>
      {isMcpMenuOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] rounded-3xl border border-border bg-surface p-5 text-left shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Model Context Protocol</h2>
              <p className="mt-1 text-xs text-muted">
                Add shared servers that characters can call when their MCP access is enabled.
              </p>
              <a
                href={MCP_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-primary transition hover:text-primary/80"
              >
                Learn about MCP
              </a>
            </div>
            <Button type="button" variant="ghost" onClick={closeMcpMenu}>
              Close
            </Button>
          </div>

          <div className="custom-scroll mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {servers.length ? (
              servers.map((server) => (
                <div
                  key={server.id}
                  className="rounded-xl border border-border/70 bg-surface/70 p-3 text-sm shadow-sm"
                >
                  <div className="grid gap-2">
                    <FormField label="Server label" required>
                      <Input
                        value={server.label}
                        placeholder="example"
                        onChange={(event) => handleServerChange(server.id, { label: event.target.value })}
                      />
                    </FormField>
                    <FormField label="Server URL" required>
                      <Input
                        value={server.url}
                        placeholder="https://mcp.example.com/mcp"
                        onChange={(event) => handleServerChange(server.id, { url: event.target.value })}
                      />
                    </FormField>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      type="button"
                      className="px-3 py-1 text-xs"
                      onClick={() => handleRemoveServer(server.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No servers configured yet.</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" variant="secondary" onClick={handleAddServer}>
              Add server
            </Button>
            <Button type="button" onClick={handleSave} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createServerDraft(): ServerDraft {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, label: '', url: '' };
}

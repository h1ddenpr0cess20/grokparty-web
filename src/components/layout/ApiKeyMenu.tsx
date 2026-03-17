import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useApiKey } from '@/features/session/apiKey';
import { useUiStore } from '@/state/uiStore';
import { showToast } from '@/state/toastStore';

const GROK_SIGNUP_URL = 'https://console.x.ai/';

/**
 * Header dropdown panel for adding/removing the user's Grok API key.
 */
export function ApiKeyMenu() {
  const { apiKey, rememberApiKey, setApiKey, clearApiKey } = useApiKey();
  const isApiKeyMenuOpen = useUiStore((state) => state.isApiKeyMenuOpen);
  const toggleApiKeyMenu = useUiStore((state) => state.toggleApiKeyMenu);
  const closeApiKeyMenu = useUiStore((state) => state.closeApiKeyMenu);

  const [keyValue, setKeyValue] = useState(apiKey ?? '');
  const [remember, setRemember] = useState(rememberApiKey);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isApiKeyMenuOpen) {
      return;
    }

    const incomingKey = apiKey ?? '';
    setKeyValue((current) => (current === incomingKey ? current : incomingKey));
    setRemember((current) => (current === rememberApiKey ? current : rememberApiKey));
  }, [apiKey, isApiKeyMenuOpen, rememberApiKey]);

  useEffect(() => {
    if (!isApiKeyMenuOpen) {
      return;
    }

    const handlePointer = (event: MouseEvent) => {
      if (!panelRef.current) {
        return;
      }
      if (event.target instanceof Node && !panelRef.current.contains(event.target)) {
        closeApiKeyMenu();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeApiKeyMenu();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKeydown);

    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKeydown);
      cancelAnimationFrame(frame);
    };
  }, [closeApiKeyMenu, isApiKeyMenuOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = keyValue.trim();
    if (!trimmed) {
      showToast({
        variant: 'danger',
        title: 'API key required',
        description: 'Enter a valid Grok API key to continue.',
        durationMs: 4000,
      });
      return;
    }

    setApiKey(trimmed, remember);
    showToast({
      variant: 'success',
      title: 'API key saved',
      description: remember
        ? 'We will remember this key on this device until you clear it.'
        : 'The key is stored in memory for this session only.',
      durationMs: 4000,
    });
    closeApiKeyMenu();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleApiKeyMenu}
        className="flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-surface/80"
      >
        API key
        <span
          className={
            apiKey
              ? 'inline-flex size-2 rounded-full bg-success'
              : 'inline-flex size-2 rounded-full bg-danger'
          }
          aria-hidden="true"
        />
      </button>
      {isApiKeyMenuOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-3xl border border-border bg-surface p-5 text-left shadow-2xl"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Grok API key</h2>
              <p className="mt-1 text-xs text-muted">
                The key stays on this device and is never sent anywhere else.
              </p>
              <a
                href={GROK_SIGNUP_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-primary transition hover:text-primary/80"
              >
                Need one? Sign up for Grok API access
              </a>
            </div>
            {apiKey ? (
              <button
                type="button"
                onClick={() => {
                  clearApiKey();
                  setKeyValue('');
                  setRemember(false);
                  showToast({
                    variant: 'warning',
                    title: 'API key cleared',
                    description: 'Future requests will fail until a new key is saved.',
                    durationMs: 3500,
                  });
                }}
                className="text-xs font-semibold text-danger underline"
              >
                Clear
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <FormField label="Key value" required>
              <Input
                ref={inputRef}
                type="password"
                placeholder="sk-..."
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Remember on this device">
              <Switch
                checked={remember}
                onClick={() => setRemember((prev) => !prev)}
                label={remember ? 'Yes' : 'No'}
              />
            </FormField>
            <Button type="submit" className="w-full">
              {apiKey ? 'Update key' : 'Save key'}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

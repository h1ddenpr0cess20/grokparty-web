import { MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import { useTheme, type ThemePreference } from './ThemeContext';

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** Small popover for switching between light/dark/system themes. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);

  const icon = useMemo(() => {
    return resolved === 'dark' ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />;
  }, [resolved]);

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-surface/80"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {icon}
        <span className="hidden sm:inline">{capitalize(preference)}</span>
        <span className="sr-only">Toggle theme</span>
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
          {OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={preference === option.value}
                onClick={() => {
                  setPreference(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10"
              >
                <span>{option.label}</span>
                {preference === option.value ? (
                  <span aria-hidden className="text-primary">•</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

import clsx from 'clsx';
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent } from 'react';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Whether the switch is on. */
  checked?: boolean;
  /** Optional label rendered to the right of the thumb. */
  label?: string;
}

/** Accessible, keyboard-friendly switch component. */
export function Switch({
  checked = false,
  className,
  label,
  onClick,
  onKeyDown,
  ...props
}: SwitchProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
    }
    onKeyDown?.(event);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={clsx(
        'inline-flex items-center gap-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <span
        className={clsx(
          'relative inline-flex h-6 w-10 items-center rounded-full border border-transparent transition',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={clsx(
            'inline-block size-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

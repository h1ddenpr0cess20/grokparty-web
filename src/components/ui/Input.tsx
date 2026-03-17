import clsx from 'clsx';
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Styled text input with forwarded ref for focus management.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={clsx(
        'border-border bg-surface text-foreground placeholder:text-muted focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-2 text-sm shadow-sm transition focus:ring-2 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
});

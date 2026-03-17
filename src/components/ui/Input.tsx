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
        'w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
        className,
      )}
      {...props}
    />
  );
});

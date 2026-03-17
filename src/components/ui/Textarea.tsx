import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Styled textarea with sensible defaults. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={clsx(
        'border-border bg-surface text-foreground placeholder:text-muted focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-2 text-sm shadow-sm transition focus:ring-2 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60',
        getVariantClasses(variant),
        className,
      )}
      {...props}
    />
  );
}

function getVariantClasses(variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return 'border border-border bg-surface/80 text-foreground hover:bg-surface/60';
    case 'ghost':
      return 'text-foreground hover:bg-surface/70';
    case 'danger':
      return 'bg-danger text-white shadow-card hover:opacity-90';
    default:
      return 'bg-primary text-white shadow-card hover:opacity-90';
  }
}

import clsx from 'clsx';
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Label + description + error wrapper to keep form markup consistent.
 */
export function FormField({
  label,
  description,
  error,
  htmlFor,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-foreground text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {description ? <p className="text-muted text-sm">{description}</p> : null}
      {children}
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}

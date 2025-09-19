import { useEffect } from 'react';
import { useToastStore } from '@/state/toastStore';

const VARIANT_CLASSES: Record<string, string> = {
  info:
    'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-200',
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning:
    'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
  danger:
    'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200',
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dismiss(toast.id);
      }, toast.durationMs),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  if (!toasts.length) {
    return null;
  }

  return (
    <ol className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <li
          key={toast.id}
          className={`pointer-events-auto overflow-hidden rounded-xl border px-4 py-3 shadow-lg transition ${
            VARIANT_CLASSES[toast.variant] ?? VARIANT_CLASSES.info
          }`}
        >
          {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
          <p className="text-sm leading-5">{toast.description}</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-foreground underline"
            onClick={() => dismiss(toast.id)}
          >
            Dismiss
          </button>
        </li>
      ))}
    </ol>
  );
}

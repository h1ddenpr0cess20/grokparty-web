import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastMessage {
  id: string;
  title?: string;
  description: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/**
 * Simple global toast store used by a viewport component to render notifications.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? createId();
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id,
          durationMs: toast.durationMs ?? 6000,
        },
      ],
    }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Convenience helper to display a toast without subscribing to the store.
 */
export function showToast(toast: Omit<ToastMessage, 'id'>) {
  return useToastStore.getState().push(toast);
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

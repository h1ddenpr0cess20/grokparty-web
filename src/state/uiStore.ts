import { create } from 'zustand';

interface ApiKeyMenuState {
  isApiKeyMenuOpen: boolean;
  openApiKeyMenu: () => void;
  closeApiKeyMenu: () => void;
  toggleApiKeyMenu: () => void;
}

/**
 * Lightweight UI store for ephemeral state that does not belong in React component state.
 */
export const useUiStore = create<ApiKeyMenuState>((set) => ({
  isApiKeyMenuOpen: false,
  openApiKeyMenu: () => set({ isApiKeyMenuOpen: true }),
  closeApiKeyMenu: () => set({ isApiKeyMenuOpen: false }),
  toggleApiKeyMenu: () =>
    set((state) => ({
      isApiKeyMenuOpen: !state.isApiKeyMenuOpen,
    })),
}));

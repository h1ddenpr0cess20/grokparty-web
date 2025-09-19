import { create } from 'zustand';

interface ApiKeyMenuState {
  isApiKeyMenuOpen: boolean;
  openApiKeyMenu: () => void;
  closeApiKeyMenu: () => void;
  toggleApiKeyMenu: () => void;
}

export const useUiStore = create<ApiKeyMenuState>((set) => ({
  isApiKeyMenuOpen: false,
  openApiKeyMenu: () => set({ isApiKeyMenuOpen: true }),
  closeApiKeyMenu: () => set({ isApiKeyMenuOpen: false }),
  toggleApiKeyMenu: () =>
    set((state) => ({
      isApiKeyMenuOpen: !state.isApiKeyMenuOpen,
    })),
}));

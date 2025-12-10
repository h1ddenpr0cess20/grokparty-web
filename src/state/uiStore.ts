import { create } from 'zustand';

interface UiState {
  isApiKeyMenuOpen: boolean;
  isMcpMenuOpen: boolean;
  openApiKeyMenu: () => void;
  closeApiKeyMenu: () => void;
  toggleApiKeyMenu: () => void;
  openMcpMenu: () => void;
  closeMcpMenu: () => void;
  toggleMcpMenu: () => void;
}

/**
 * Lightweight UI store for ephemeral state that does not belong in React component state.
 */
export const useUiStore = create<UiState>((set) => ({
  isApiKeyMenuOpen: false,
  isMcpMenuOpen: false,
  openApiKeyMenu: () => set((state) => ({ ...state, isApiKeyMenuOpen: true, isMcpMenuOpen: false })),
  closeApiKeyMenu: () => set((state) => ({ ...state, isApiKeyMenuOpen: false })),
  toggleApiKeyMenu: () =>
    set((state) => ({
      ...state,
      isApiKeyMenuOpen: !state.isApiKeyMenuOpen,
      isMcpMenuOpen: state.isApiKeyMenuOpen ? state.isMcpMenuOpen : false,
    })),
  openMcpMenu: () => set((state) => ({ ...state, isMcpMenuOpen: true, isApiKeyMenuOpen: false })),
  closeMcpMenu: () => set((state) => ({ ...state, isMcpMenuOpen: false })),
  toggleMcpMenu: () =>
    set((state) => ({
      ...state,
      isMcpMenuOpen: !state.isMcpMenuOpen,
      isApiKeyMenuOpen: state.isMcpMenuOpen ? state.isApiKeyMenuOpen : false,
    })),
}));

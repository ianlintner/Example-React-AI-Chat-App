import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

interface UIState {
  sidebarOpen: boolean;
  theme: ThemePreference;
  activeConversationId: string | null;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (t: ThemePreference) => void;
  setActiveConversationId: (id: string | null) => void;
}

export const useUIStore = create<UIState>(set => ({
  sidebarOpen: true,
  theme: 'system',
  activeConversationId: null,
  setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
  setTheme: theme => set({ theme }),
  setActiveConversationId: activeConversationId =>
    set({ activeConversationId }),
}));

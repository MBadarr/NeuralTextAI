import { create } from "zustand";

type WorkspaceState = {
  active: string;
  collapsed: boolean;
  mobileOpen: boolean;
  query: string;
  selectPage: (page: string) => void;
  toggleCollapsed: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
  setQuery: (query: string) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  active: "Overview",
  collapsed: false,
  mobileOpen: false,
  query: "",
  selectPage: (active) => set({ active, mobileOpen: false }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
  closeMobile: () => set({ mobileOpen: false }),
  setQuery: (query) => set({ query }),
}));

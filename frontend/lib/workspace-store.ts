import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      active: "Overview",
      collapsed: false,
      mobileOpen: false,
      query: "",
      selectPage: (active) => set({ active, mobileOpen: false }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
      closeMobile: () => set({ mobileOpen: false }),
      setQuery: (query) => set({ query }),
    }),
    {
      name: "neuraltext-workspace",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            const value = localStorage.getItem(name);
            if (value) JSON.parse(value);
            return value;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            /* Preferences are optional. */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* Preferences are optional. */
          }
        },
      })),
      skipHydration: true,
      partialize: ({ active, collapsed }) => ({ active, collapsed }),
      merge: (persisted, current) => {
        const preferences = persisted as
          | { active?: unknown; collapsed?: unknown }
          | undefined;
        return {
          ...current,
          active:
            typeof preferences?.active === "string"
              ? preferences.active
              : "Overview",
          collapsed:
            typeof preferences?.collapsed === "boolean"
              ? preferences.collapsed
              : false,
          query: "",
          mobileOpen: false,
        };
      },
    },
  ),
);

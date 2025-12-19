/**
 * UI State Store - Sidebar, modals, and UI preferences
 */

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        sidebarCollapsed: false,
        commandPaletteOpen: false,

        toggleSidebar: () =>
          set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, "ui/toggleSidebar"),

        setSidebarOpen: (open) =>
          set({ sidebarOpen: open }, false, "ui/setSidebarOpen"),

        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }, false, "ui/setSidebarCollapsed"),

        toggleCommandPalette: () =>
          set(
            (s) => ({ commandPaletteOpen: !s.commandPaletteOpen }),
            false,
            "ui/toggleCommandPalette"
          ),

        setCommandPaletteOpen: (open) =>
          set({ commandPaletteOpen: open }, false, "ui/setCommandPaletteOpen"),
      }),
      {
        name: "ui-store",
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
        }),
      }
    ),
    { name: "ui-store" }
  )
);

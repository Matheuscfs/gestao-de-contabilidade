import { create } from "zustand";

interface HeaderActionsState {
  onAdicionar: (() => void) | null;
  setOnAdicionar: (fn: (() => void) | null) => void;
}

export const useHeaderActionsStore = create<HeaderActionsState>((set) => ({
  onAdicionar: null,
  setOnAdicionar: (onAdicionar) => set({ onAdicionar }),
}));

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { SessionData } from "@qbitui/core";

interface SessionStore {
  session: SessionData | null;
  isLoading: boolean;
  setSession: (session: SessionData | null) => void;
  loadSession: () => Promise<void>;
  clearSession: () => Promise<void>;
}

const SESSION_KEY = "qbitui_session";

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  isLoading: true,

  setSession: (session) => set({ session }),

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw) {
        set({ session: JSON.parse(raw) as SessionData, isLoading: false });
      } else {
        set({ session: null, isLoading: false });
      }
    } catch {
      set({ session: null, isLoading: false });
    }
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ session: null });
  },
}));

export async function persistSession(session: SessionData): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  useSessionStore.getState().setSession(session);
}

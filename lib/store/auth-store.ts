'use client';

import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  avatar?: string;
  createdAt?: string;
}

interface SessionPayload {
  actorId: string;
  isGuest: boolean;
  user: AuthUser | null;
}

interface SessionResponse {
  session: SessionPayload;
}

interface AuthState {
  actorId: string | null;
  currentUser: AuthUser | null;
  isGuest: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  ensureSession: () => Promise<string>;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
}

let sessionPromise: Promise<void> | null = null;

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function requestSession(init?: RequestInit): Promise<SessionPayload> {
  const response = await fetch('/api/users', {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const data = await readJson<SessionResponse & { error?: string }>(response);
  if (!response.ok || !data.session) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.session;
}

function applySession(set: (partial: Partial<AuthState>) => void, session: SessionPayload) {
  set({
    actorId: session.actorId,
    currentUser: session.user,
    isGuest: session.isGuest,
    isInitialized: true,
    error: null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  actorId: null,
  currentUser: null,
  isGuest: true,
  isLoading: false,
  isInitialized: false,
  error: null,
  ensureSession: async () => {
    if (get().actorId) {
      return get().actorId as string;
    }

    if (!sessionPromise) {
      sessionPromise = (async () => {
        set({ isLoading: true });
        try {
          const session = await requestSession();
          applySession(set, session);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          set({ isLoading: false });
          sessionPromise = null;
        }
      })();
    }

    await sessionPromise;
    return get().actorId as string;
  },
  refreshSession: async () => {
    set({ isLoading: true });
    try {
      const session = await requestSession();
      applySession(set, session);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await requestSession({
        method: 'POST',
        body: JSON.stringify({ action: 'login', username, password }),
      });
      applySession(set, session);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  register: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await requestSession({
        method: 'POST',
        body: JSON.stringify({ action: 'register', username, password }),
      });
      applySession(set, session);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  updateProfile: async (updates) => {
    set({ isLoading: true, error: null });
    try {
      const session = await requestSession({
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      applySession(set, session);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await requestSession({
        method: 'DELETE',
      });
      applySession(set, session);
    } finally {
      set({ isLoading: false });
    }
  },
}));

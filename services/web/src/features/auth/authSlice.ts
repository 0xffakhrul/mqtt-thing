import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Session = {
  token: string;
  email: string;
  tenantId: string;
};

type AuthState = { session: Session | null };
export type AuthRoot = { auth: AuthState };

const STORAGE_KEY = 'mqtt-thing.session';

const loadSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const data = JSON.parse(raw) as Partial<Session>;
    if (
      typeof data.token !== 'string' ||
      typeof data.email !== 'string' ||
      typeof data.tenantId !== 'string'
    ) {
      return null;
    }
    return { token: data.token, email: data.email, tenantId: data.tenantId };
  } catch {
    return null;
  }
};

export const saveSession = (session: Session | null): void => {
  try {
    if (session === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode, blocked); you just stay signed in for this tab.
  }
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: (): AuthState => ({ session: loadSession() }),
  reducers: {
    loggedIn: (state, action: PayloadAction<Session>) => {
      state.session = action.payload;
    },
    loggedOut: (state) => {
      state.session = null;
    },
  },
});

export const { loggedIn, loggedOut } = authSlice.actions;

export const selectSession = (state: AuthRoot): Session | null => state.auth.session;

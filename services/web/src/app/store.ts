import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../api/api.js';
import { authSlice, saveSession } from '../features/auth/authSlice.js';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [authSlice.name]: authSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

setupListeners(store.dispatch);

let lastSession = store.getState().auth.session;
store.subscribe(() => {
  const session = store.getState().auth.session;
  if (session === lastSession) return;
  lastSession = session;
  saveSession(session);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

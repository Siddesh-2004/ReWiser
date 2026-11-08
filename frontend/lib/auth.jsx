import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, configureApi } from './api';

const KEY = 'auth';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, token: null, user: null });
  // The API client reads the token from a ref so it never sees a stale value.
  const tokenRef = useRef(null);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    setState({ loading: false, token: null, user: null });
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {}
  }, []);

  useEffect(() => {
    configureApi({ getToken: () => tokenRef.current, onUnauthorized: signOut });
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const { token, user } = JSON.parse(raw);
          tokenRef.current = token;
          setState({ loading: false, token, user });
          return;
        }
      } catch {}
      setState({ loading: false, token: null, user: null });
    })();
  }, [signOut]);

  const persist = async ({ token, user }) => {
    tokenRef.current = token;
    setState({ loading: false, token, user });
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ token, user }));
    } catch {}
  };

  const signIn = async (email, password) => persist(await api.login({ email, password }));
  const signUp = async (name, email, password) => persist(await api.register({ name, email, password }));

  return <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

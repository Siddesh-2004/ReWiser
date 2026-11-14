import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { API_URL } from './config';
import { configureApi } from './api';

WebBrowser.maybeCompleteAuthSession();

const KEY = 'auth';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, token: null, user: null });
  // The API client reads the token from a ref so it never sees a stale value.
  const tokenRef = useRef(null);

  const persist = useCallback(async ({ token, user }) => {
    tokenRef.current = token;
    setState({ loading: false, token, user });
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ token, user }));
    } catch {}
  }, []);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    setState({ loading: false, token: null, user: null });
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {}
  }, []);

  const completeSignIn = useCallback(async (queryParams) => {
    if (!queryParams?.token) return false;
    await persist({
      token: String(queryParams.token),
      user: {
        name: queryParams.name ? String(queryParams.name) : null,
        email: queryParams.email ? String(queryParams.email) : null,
        avatarUrl: queryParams.avatar ? String(queryParams.avatar) : null,
      },
    });
    return true;
  }, [persist]);

  // On launch: restore the saved session, if any.
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

  // Opens Notion in an in-app browser. The backend ends the flow by redirecting to
  // `returnUrl?token=...`, and openAuthSessionAsync hands that URL back to us.
  const signInWithNotion = async () => {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const returnUrl = Linking.createURL('auth', isExpoGo ? { scheme: 'exp' } : undefined);
    const parsedReturnUrl = Linking.parse(returnUrl);
    console.info('[auth] opening browser session', {
      executionEnvironment: Constants.executionEnvironment,
      returnScheme: parsedReturnUrl.scheme,
      returnHost: parsedReturnUrl.hostname,
      returnPath: parsedReturnUrl.path,
    });
    const startUrl = `${API_URL}/auth/notion?redirect=${encodeURIComponent(returnUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
    console.info('[auth] browser session finished', { resultType: result.type });
    if (result.type !== 'success') return false; // user closed the window

    const parsedResult = Linking.parse(result.url);
    const { queryParams } = parsedResult;
    console.info('[auth] app redirect received', {
      scheme: parsedResult.scheme,
      path: parsedResult.path,
      queryKeys: Object.keys(queryParams ?? {}),
      hasSessionToken: Boolean(queryParams?.token),
    });
    if (!queryParams?.token) throw new Error('Sign-in did not return a session. Please try again.');

    console.info('[auth] persisting app session');
    await completeSignIn(queryParams);
    console.info('[auth] app session persisted');
    return true;
  };

  // Dev only: lets you see the home screen without a running backend.
  const devSkip = () => persist({ token: 'dev-token', user: { name: 'Siddesh', email: 'dev@example.com', avatarUrl: null } });

  return <AuthContext.Provider value={{ ...state, signInWithNotion, completeSignIn, devSkip, signOut }}>{children}</AuthContext.Provider>;
}

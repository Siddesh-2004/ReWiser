import React, { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import { LoadingScreen } from '../components/Logo';

SplashScreen.preventAutoHideAsync();

const MIN_LOADING_MS = 1400; // keep the animated logo up long enough to be seen

function RootNavigator() {
  const { loading, token } = useAuth();
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    DMSans_400Regular,
    DMSans_500Medium,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync(); // hand over from the native splash to <LoadingScreen/>
    const t = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  if (!fontsLoaded || loading || !minElapsed) return <LoadingScreen showText={fontsLoaded} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="auth" />
      {/* Logged in: tabs exist. Logged out: Expo Router falls back to the (auth) group. */}
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

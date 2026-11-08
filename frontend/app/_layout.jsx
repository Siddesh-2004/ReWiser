import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

// Keep the splash screen up until fonts and the saved login are ready.
SplashScreen.preventAutoHideAsync();

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
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* Logged in: these screens exist. Logged out: Expo Router redirects to the (auth) group. */}
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="topic/new" />
        <Stack.Screen name="topic/[id]/index" />
        <Stack.Screen name="topic/[id]/edit" />
        <Stack.Screen name="interview" options={{ gestureEnabled: false }} />
        <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="review/[id]" />
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

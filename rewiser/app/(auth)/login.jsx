import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, T, Button, Banner } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../lib/auth';

export default function Login() {
  const { signInWithNotion, devSkip } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signInWithNotion();
      // On success the guard in app/_layout.jsx swaps to the tabs by itself.
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={{ justifyContent: 'space-between', paddingVertical: 32 }}>
      <View />

      <View style={{ alignItems: 'center', gap: 20 }}>
        <Logo size={88} />
        <View style={{ alignItems: 'center', gap: 10 }}>
          <T v="eyebrow">Re-Wiser</T>
          <T v="title" style={{ fontSize: 34, lineHeight: 40, textAlign: 'center' }}>
            Say it out loud.{'\n'}Remember it longer.
          </T>
          <T v="caption" style={{ textAlign: 'center', maxWidth: 280 }}>
            Turn your Notion notes into spoken revision sessions.
          </T>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Banner message={error} />
        <Button title="Continue with Notion" icon="arrow-forward" onPress={submit} loading={busy} />
        <T v="caption" style={{ textAlign: 'center' }}>
          We'll open Notion so you can choose which pages to share.
        </T>
        {__DEV__ ? <Button title="Skip login (dev only)" variant="ghost" onPress={devSkip} /> : null}
      </View>
    </Screen>
  );
}

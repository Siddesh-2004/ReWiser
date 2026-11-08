import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, T, Field, Button, Banner } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // The guard in app/_layout.jsx now sends us to the tabs. Nothing else to do.
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: 20 }}>
      <View style={{ gap: 6 }}>
        <T v="title">Voice Revision</T>
        <T v="caption">Practice technical interviews out loud.</T>
      </View>
      <Banner message={error} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Your password" onSubmitEditing={submit} />
      <Button title="Log in" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.push('/register')} style={{ alignItems: 'center', padding: 8 }}>
        <T v="caption">No account? <T v="caption" color={colors.onSurface} style={{ textDecorationLine: 'underline' }}>Create one</T></T>
      </Pressable>
    </Screen>
  );
}

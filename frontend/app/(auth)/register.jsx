import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, T, Field, Button, Banner } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: 20 }}>
      <View style={{ gap: 6 }}>
        <T v="title">Create account</T>
        <T v="caption">Your topics and sessions are saved to your account.</T>
      </View>
      <Banner message={error} />
      <Field label="Name (optional)" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" onSubmitEditing={submit} />
      <Button title="Create account" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 8 }}>
        <T v="caption">Already have an account? <T v="caption" color={colors.onSurface} style={{ textDecorationLine: 'underline' }}>Log in</T></T>
      </Pressable>
    </Screen>
  );
}

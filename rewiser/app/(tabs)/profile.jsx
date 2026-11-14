import React from 'react';
import { View } from 'react-native';
import { Screen, T, Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

export default function Profile() {
  const { user, signOut } = useAuth();
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <Screen edges={['top']}>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <T v="title" color={colors.onSecondaryContainer}>{initial}</T>
        </View>
        <T v="heading">{user?.name || 'Student'}</T>
        {user?.email ? <T v="caption">{user.email}</T> : null}
      </View>
      <Button title="Log out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

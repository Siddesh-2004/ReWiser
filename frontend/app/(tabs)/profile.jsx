import React from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { Screen, TabHeader, T, Card, Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { API_URL } from '../../lib/config';

export default function Profile() {
  const { user, signOut } = useAuth();

  function confirmLogout() {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen edges={['top']} header={<TabHeader title="Profile" />}>
      <Card>
        <T v="heading">{(user && user.name) || 'Your account'}</T>
        <T v="caption">{user && user.email}</T>
      </Card>
      <Button title="Log out" variant="danger" onPress={confirmLogout} />
      <T v="mono" style={{ textAlign: 'center' }}>
        v{(Constants.expoConfig && Constants.expoConfig.version) || '1.0.0'} · {API_URL}
      </T>
    </Screen>
  );
}

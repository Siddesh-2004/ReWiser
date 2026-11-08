import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';

const icon = (name) => ({ color, size }) => <MaterialIcons name={name} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.outlineVariant },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Topics', tabBarIcon: icon('category') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('history') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account-circle') }} />
    </Tabs>
  );
}

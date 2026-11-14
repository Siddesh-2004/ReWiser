import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, type } from '../../lib/theme';

const tabIcons = {
  index: 'home-outline',
  plans: 'clipboard-check-outline',
  profile: 'account-outline',
};

const tabLabels = {
  index: 'Home',
  plans: 'Plans',
  profile: 'Profile',
};

function CapsuleTabBar({ state, descriptors }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 20), pointerEvents: 'box-none' }}>
      <View
        style={{
          width: '100%',
          maxWidth: 428,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 6,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.72)',
          borderRadius: 30,
          backgroundColor: 'rgba(255, 255, 255, 0.84)',
          elevation: 14,
          shadowColor: colors.onSurface,
          shadowOpacity: 0.10,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 7 },
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)' } : {}),
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? tabLabels[route.name];
          const focused = state.index === index;
          const color = focused ? colors.onSurface : colors.outline;

          const onPress = () => {
            if (!focused) router.navigate(route.name === 'index' ? '/' : `/${route.name}`);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                height: 58,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                borderRadius: 23,
                backgroundColor: focused ? 'rgba(25, 25, 25, 0.055)' : 'transparent',
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons name={tabIcons[route.name]} size={23} color={color} />
              <Text style={{ ...type.mono, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ width: 128, height: 4, marginTop: 14, borderRadius: 2, backgroundColor: 'rgba(25, 25, 25, 0.20)' }} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: 136 },
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <CapsuleTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: tabLabels.index }} />
      <Tabs.Screen name="plans" options={{ title: tabLabels.plans }} />
      <Tabs.Screen name="profile" options={{ title: tabLabels.profile }} />
    </Tabs>
  );
}

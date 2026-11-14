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
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), pointerEvents: 'box-none' }}>
      <View
        style={{
          width: '92%',
          maxWidth: 360,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 4,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.58)',
          borderRadius: 27,
          backgroundColor: 'rgba(255, 255, 255, 0.84)',
          elevation: 10,
          shadowColor: colors.onSurface,
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 5 },
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
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
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                borderRadius: 21,
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
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: 0 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
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

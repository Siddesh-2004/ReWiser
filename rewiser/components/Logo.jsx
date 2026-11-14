import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { colors } from '../lib/theme';
import { T } from './ui';

const HEIGHTS = [0.34, 0.62, 1, 0.62, 0.34]; // same shape as assets/icon.png

// The app mark: a dark tile with five "voice" bars. Pass `animate` for the loading version.
export function Logo({ size = 72, animate = false }) {
  const box = size * 0.42;
  const barW = (box - box * 0.075 * 4) / 5;
  const gap = box * 0.075;
  const anims = useRef(HEIGHTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!animate) return;
    // Each bar breathes up and down, offset from its neighbour, like a waveform.
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [animate, anims]);

  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.225, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
        {HEIGHTS.map((h, i) => (
          <Animated.View
            key={i}
            style={{
              width: barW,
              height: box * h,
              borderRadius: barW / 2,
              backgroundColor: i === 2 ? '#ffffff' : colors.secondaryContainer,
              transform: animate ? [{ scaleY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] }) }] : undefined,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// Shown while fonts load and the saved login is restored. Same background and logo
// position as the native splash, so the hand-off is seamless.
export function LoadingScreen({ showText }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Logo size={96} animate />
      {/* Text only appears once the fonts are ready, to avoid a flash of the wrong typeface */}
      <View style={{ height: 40, alignItems: 'center', gap: 4 }}>
        {showText ? (
          <>
            <T v="heading">Re-Wiser</T>
            <T v="eyebrow">Getting things ready</T>
          </>
        ) : null}
      </View>
    </View>
  );
}

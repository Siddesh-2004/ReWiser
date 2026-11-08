import React from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, type, scoreColor } from '../lib/theme';

// Text with one of the type-scale variants from theme.js
export function T({ v = 'body', color, style, ...rest }) {
  return <Text {...rest} style={[type[v], color ? { color } : null, style]} />;
}

export function Screen({ header, footer, scroll, edges = ['top', 'bottom'], contentStyle, children }) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function IconButton({ name, onPress, color = colors.onSurface, size = 22, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.iconBtn, style]}>
      <MaterialIcons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Header({ title, onBack, backIcon = 'arrow-back', right, center }) {
  return (
    <View style={styles.header}>
      {onBack ? <IconButton name={backIcon} onPress={onBack} /> : <View style={{ width: 40 }} />}
      <View style={styles.headerCenter}>{center || <T v="label" numberOfLines={1}>{title}</T>}</View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// Big left-aligned title used on the three tab screens
export function TabHeader({ title, right }) {
  return (
    <View style={[styles.header, { paddingHorizontal: 20 }]}>
      <T v="heading" style={{ flex: 1 }}>{title}</T>
      {right}
    </View>
  );
}

const buttonVariants = {
  primary: { box: { backgroundColor: colors.primary }, text: colors.onPrimary },
  outline: { box: { borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.lowest }, text: colors.onSurface },
  danger: { box: { borderWidth: 1, borderColor: colors.errorContainer, backgroundColor: colors.lowest }, text: colors.error },
  ghost: { box: {}, text: colors.onSurfaceVariant },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.btn, v.box, pressed && { opacity: 0.85 }, off && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          <Text style={[type.label, { color: v.text }]}>{title}</Text>
          {icon ? <MaterialIcons name={icon} size={18} color={v.text} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, counter, style, ...input }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="eyebrow">{label}</T> : null}
      <TextInput
        placeholderTextColor={colors.outline}
        {...input}
        style={[styles.input, input.multiline && styles.multiline, error && { borderColor: colors.error }, style]}
      />
      {counter ? <T v="mono" style={{ textAlign: 'right' }}>{counter}</T> : null}
      {error ? <T v="caption" color={colors.error}>{error}</T> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <T v="caption" color={active ? colors.onPrimary : colors.onSurfaceVariant} style={{ fontFamily: type.label.fontFamily }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: colors.low, fg: colors.onSurface, border: colors.outlineVariant },
    green: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, border: colors.secondaryContainer },
    red: { bg: colors.errorContainer, fg: colors.onErrorContainer, border: colors.errorContainer },
    amber: { bg: '#fdf0d5', fg: '#7a5210', border: '#fdf0d5' },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: tones.bg, borderColor: tones.border }]}>
      <T v="mono" color={tones.fg}>{label}</T>
    </View>
  );
}

export function Card({ children, onPress, style }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={[styles.card, style]}>
      {children}
    </Comp>
  );
}

export function ScoreBar({ label, weight, value }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T v="label">{label}</T>
          {weight ? <T v="mono">{Math.round(weight * 100)}%</T> : null}
        </View>
        <T v="mono" color={colors.onSurface}>{value.toFixed(1)} / 10</T>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(0, Math.min(10, value)) * 10}%`, backgroundColor: scoreColor(value) }]} />
      </View>
    </View>
  );
}

export function Banner({ message, tone = 'error', style }) {
  if (!message) return null;
  const err = tone === 'error';
  return (
    <View style={[styles.banner, { backgroundColor: err ? colors.errorContainer : colors.container }, style]}>
      <MaterialIcons name={err ? 'error-outline' : 'info-outline'} size={18} color={err ? colors.onErrorContainer : colors.onSurfaceVariant} />
      <T v="caption" color={err ? colors.onErrorContainer : colors.onSurfaceVariant} style={{ flex: 1 }}>{message}</T>
    </View>
  );
}

export function Loading({ message }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.onSurface} />
      {message ? <T v="caption" style={{ textAlign: 'center', marginTop: 12 }}>{message}</T> : null}
    </View>
  );
}

export function Empty({ icon = 'inbox', title, message, action }) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon} size={24} color={colors.onSurfaceVariant} />
      </View>
      <T v="heading" style={{ fontSize: 17 }}>{title}</T>
      {message ? <T v="caption" style={{ textAlign: 'center', marginTop: 4, maxWidth: 260 }}>{message}</T> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { minWidth: 40, alignItems: 'flex-end', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: colors.lowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontFamily: type.body.fontFamily, fontSize: 15, color: colors.onSurface },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.low },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  card: { backgroundColor: colors.lowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 10, padding: 16, gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.container, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.container, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});

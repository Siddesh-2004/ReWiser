// Colours and type scale taken from the HTML designs' Tailwind config.
export const colors = {
  background: '#faf9f6',
  lowest: '#ffffff',
  low: '#f4f3f0',
  container: '#efeeeb',
  high: '#e9e8e5',
  highest: '#e3e2e0',
  onSurface: '#1a1c1a',
  onSurfaceVariant: '#44474a',
  outline: '#75777a',
  outlineVariant: '#d6d5d1',
  primary: '#06080a',
  primaryContainer: '#1e2022',
  onPrimary: '#ffffff',
  secondary: '#566153',
  secondaryContainer: '#dae6d3',
  onSecondaryContainer: '#3f4a3c',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  amber: '#b7791f',
  good: '#3d6b45',
};

export const fonts = {
  headline: 'Newsreader_400Regular',
  headlineMedium: 'Newsreader_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
};

export const type = {
  title: { fontFamily: fonts.headline, fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: colors.onSurface },
  heading: { fontFamily: fonts.headline, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: colors.onSurface },
  question: { fontFamily: fonts.headline, fontSize: 25, lineHeight: 33, letterSpacing: -0.3, color: colors.onSurface },
  score: { fontFamily: fonts.headlineMedium, fontSize: 44, lineHeight: 50, color: colors.onSurface },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.onSurface },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.onSurface },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
  mono: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.onSurfaceVariant },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
};

// 0-4 red, 5-6 amber, 7-10 green
export const scoreColor = (n) => (n >= 7 ? colors.good : n >= 5 ? colors.amber : colors.error);

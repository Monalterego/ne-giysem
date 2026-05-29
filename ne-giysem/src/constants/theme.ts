// ─── COLORS ───────────────────────────────────────────────────────────────────

export const colors = {
  // Base
  black: '#0A0A0A',
  white: '#FFFFFF',

  // Backgrounds
  background: '#FAFAFA',
  surface:    '#F5F4F2',

  // Borders
  border:       '#E8E6E1',
  borderStrong: '#C8C4BC',

  // Text
  text:          '#0A0A0A',
  textSecondary: '#6B6B6B',
  textTertiary:  '#A8A8A8',

  // Accent — sıcak gold
  accent:      '#B8965A',
  accentLight: '#F0E8D8',

  // Semantic
  error:   '#C0392B',
  success: '#2D6A4F',
} as const;

// ─── SPACING — 8pt grid ───────────────────────────────────────────────────────

export const spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────

export const fonts = {
  heading:      'PlayfairDisplay_700Bold',
  headingBold:  'PlayfairDisplay_700Bold',
  headingRegular: 'PlayfairDisplay_400Regular',
  body:         'DMSans_400Regular',
  bodyMedium:   'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold:     'DMSans_700Bold',
} as const;

export const typography = {
  hero:      { fontFamily: fonts.heading,      fontSize: 40, letterSpacing: -1,   lineHeight: 48 },
  h1:        { fontFamily: fonts.heading,      fontSize: 32, letterSpacing: -0.5, lineHeight: 40 },
  h2:        { fontFamily: fonts.heading,      fontSize: 24, letterSpacing: -0.3, lineHeight: 32 },
  h3:        { fontFamily: fonts.bodySemiBold, fontSize: 18,                      lineHeight: 24 },
  body:      { fontFamily: fonts.body,         fontSize: 14,                      lineHeight: 22 },
  bodySmall: { fontFamily: fonts.body,         fontSize: 12,                      lineHeight: 18 },
  label:     { fontFamily: fonts.bodyMedium,   fontSize: 10, letterSpacing: 2,    textTransform: 'uppercase' as const },
  caption:   { fontFamily: fonts.body,         fontSize: 11,                      lineHeight: 16 },
} as const;

// ─── BORDER RADIUS — minimal, max 12 ─────────────────────────────────────────

export const radius = {
  none: 0,
  xs:   2,
  sm:   4,
  md:   8,
  lg:   12,
  full: 999,
} as const;

// ─── SHADOWS — çok minimal ────────────────────────────────────────────────────

export const shadows = {
  none: {},
  subtle: {
    shadowColor:  '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  3,
    elevation: 1,
  },
  card: {
    shadowColor:  '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation: 2,
  },
} as const;

// ─── LAYOUT ───────────────────────────────────────────────────────────────────

export const layout = {
  screenPaddingH: 20,
  screenPaddingV: 24,
  maxWidth:       428,
  sectionSpacing: 48,
} as const;

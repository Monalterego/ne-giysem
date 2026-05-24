export const colors = {
  primary: '#1A1A2E',
  secondary: '#0F3460',
  accent: '#E94560',
  background: '#FAFAFA',
  white: '#FFFFFF',
  muted: '#888888',
  border: '#EEEEEE',
  surface: '#F8F8F8',
  success: '#00B894',
  warning: '#F0932B',
  overlay: 'rgba(26,26,46,0.06)',
};

// Sistem fontları — npm install sonrası DM Sans / Playfair Display ile değiştirilecek
export const fonts = {
  body: undefined,
  bodyMedium: undefined,
  bodySemiBold: undefined,
  bodyBold: undefined,
  bodyExtraBold: undefined,
  heading: undefined,
  headingBold: undefined,
} as const satisfies Record<string, string | undefined>;

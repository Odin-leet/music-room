// Every visual decision lives here. Screens and ui/ components reference
// these names, never raw values — applying the real design later means
// editing this file, not every screen. Current values are neutral placeholders.

export const colors = {
  background: '#FFFFFF',
  surface: '#F4F4F6', // cards, inputs
  text: '#111111',
  textMuted: '#6B6B76',
  primary: '#5B3DF5', // main actions, links
  onPrimary: '#FFFFFF', // text/icons on primary
  success: '#1F9D55',
  danger: '#D64545', // errors, destructive actions
  border: '#E2E2E8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  size: { sm: 13, md: 16, lg: 20, xl: 28 },
  weight: { regular: '400', medium: '500', bold: '700' },
} as const;

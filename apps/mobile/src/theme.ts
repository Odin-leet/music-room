// Every visual decision lives here. Screens and ui/ components reference
// these names, never raw values — changing the design means editing this
// file, not every screen.

// Dark theme from the project palette (coolors: 150B17 201723 3C3640 68525D
// D1CDCC). Contrast checked (WCAG): text on background 12.2:1, on surfaces
// 11:1. The palette's mauve #68525D is only 2.7:1 on the background, so it
// is used for FILLS (buttons, selected chips, progress) — never as text or
// an icon colour; `accent` is its readable tint for that (6.3:1).
export const colors = {
  background: '#150B17', // screens
  surface: '#201723', // cards, inputs, tab bar, mini-player
  surfaceRaised: '#3C3640', // secondary buttons, pressed rows, unselected chips
  border: '#3C3640', // decorative lines (1.6:1: never the only sign of something)
  primary: '#68525D', // FILLS: main buttons, selected chips, progress bars
  onPrimary: '#D1CDCC', // text / icons on primary (4.5:1)
  accent: '#9D9095', // mauve as text / icon: links, the playing track (6.3:1)
  text: '#D1CDCC', // body text (12.2:1)
  textMuted: '#A2969A', // secondary text (6.7:1)
  success: '#8CC29C', // not in the palette: muted green that fits it (9.4:1)
  danger: '#E07A80', // not in the palette: muted red that fits it (6.7:1)
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  size: { sm: 13, md: 16, lg: 20, xl: 28 },
  weight: { regular: '400', medium: '500', bold: '700' },
} as const;

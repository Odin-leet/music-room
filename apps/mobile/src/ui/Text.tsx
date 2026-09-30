import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { colors, font } from '@/theme';

type Variant = 'title' | 'body' | 'muted' | 'error' | 'success';

type Props = TextProps & { variant?: Variant };

export function Text({ variant = 'body', style, ...rest }: Props) {
  return <RNText style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: font.size.md },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold },
  body: {},
  muted: { color: colors.textMuted, fontSize: font.size.sm },
  error: { color: colors.danger, fontSize: font.size.sm },
  success: { color: colors.success, fontSize: font.size.lg, fontWeight: font.weight.medium },
});

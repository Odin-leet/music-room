import { StyleSheet, View } from 'react-native';
import { colors, font } from '@/theme';
import { Text } from './Text';

// Initials in a circle (we don't store profile pictures). The tint is picked
// from the name, so the same person always gets the same one.
const TINTS = [colors.primary, colors.surfaceRaised, '#4E3A47', '#5A4B5E'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const tint = TINTS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: font.weight.bold, color: colors.text }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});

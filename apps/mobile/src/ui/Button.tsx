import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  // Shows a spinner and blocks presses — prevents double-submitting forms.
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.text }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  // Tonal: an outline in the palette's mauve would barely show on the dark background.
  secondary: { backgroundColor: colors.surfaceRaised },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
  label: { fontSize: font.size.md, fontWeight: font.weight.medium },
});

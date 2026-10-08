import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';
import { Text } from './Text';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: IconName;
  size?: 'md' | 'sm';
  // Shows a spinner and blocks presses — prevents double-submitting forms.
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, size = 'md', loading = false, disabled = false }: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  // Disabled = the dark surface with muted text: clearly "not yet", not a faded colour.
  const color = disabled ? colors.textMuted : primary ? colors.onPrimary : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={color} /> : null}
          <Text style={[styles.label, size === 'sm' && styles.labelSmall, { color }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 36, paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.primary },
  // Tonal: an outline in the palette's mauve would barely show on the dark background.
  secondary: { backgroundColor: colors.surfaceRaised },
  disabled: { backgroundColor: colors.surface },
  pressed: { opacity: 0.8 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: font.size.md, fontWeight: font.weight.bold },
  labelSmall: { fontSize: font.size.sm },
});

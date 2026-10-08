import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import type { IconName } from './Button';

type Props = {
  icon: IconName;
  // What it does, for screen readers ("Remove Get Lucky").
  label: string;
  onPress: () => void;
  variant?: 'plain' | 'tonal' | 'filled';
  size?: number;
  disabled?: boolean;
};

// A round icon-only button (play, next, remove, move…).
export function IconButton({ icon, label, onPress, variant = 'plain', size = 40, disabled = false }: Props) {
  const color = disabled ? colors.textMuted : variant === 'filled' ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'tonal' && styles.tonal,
        variant === 'filled' && styles.filled,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  tonal: { backgroundColor: colors.surfaceRaised },
  filled: { backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});

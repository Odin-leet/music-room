import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from '@/ui';

// The top of the sign-in screens: who we are, then what this screen does.
export function BrandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="musical-notes" size={34} color={colors.onPrimary} />
      </View>
      <Text variant="caption" style={styles.brand}>
        MUSIC ROOM
      </Text>
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="muted" style={styles.center}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brand: { letterSpacing: 2, color: colors.accent },
  center: { textAlign: 'center' },
});

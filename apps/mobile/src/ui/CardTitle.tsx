import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import type { IconName } from './Button';
import { Text } from './Text';

// The top of a Card: an icon, a title, and an optional line under it
// (e.g. who can see this part of your profile).
export function CardTitle({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text variant="heading">{title}</Text>
      </View>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

import { Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from './Text';

// "Up next ·  See all"
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text variant="heading">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${action}: ${title}`}>
          <Text variant="muted">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
});

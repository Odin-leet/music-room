import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Button, type IconName } from './Button';
import { Text } from './Text';

// An empty list says what to do next, instead of a blank screen.
export function EmptyState(props: { icon: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={props.icon} size={40} color={colors.accent} />
      <Text variant="heading" style={styles.center}>
        {props.title}
      </Text>
      {props.text ? (
        <Text variant="muted" style={styles.center}>
          {props.text}
        </Text>
      ) : null}
      {props.action && props.onAction ? <Button title={props.action} size="sm" onPress={props.onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  center: { textAlign: 'center' },
});

import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

// Title (+ subtitle) at the top of a screen, an optional back arrow, and
// actions on the right (icon buttons).
export function ScreenHeader(props: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      {props.back ? <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} /> : null}
      <View style={styles.text}>
        <Text variant="title" numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text variant="muted" numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.right ? <View style={styles.right}>{props.right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './Text';

// "──── or ────" between alternative actions (e.g. password vs Google).
export function OrDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text variant="muted">or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});

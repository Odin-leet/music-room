import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { Text } from './Text';

// "● Live" while the realtime socket is joined, grey otherwise.
export function LiveDot({ status }: { status: 'connecting' | 'live' | 'offline' }) {
  const live = status === 'live';
  return (
    <View style={styles.live} accessibilityLabel={`Live updates: ${status}`}>
      <View style={[styles.dot, { backgroundColor: live ? colors.success : colors.textMuted }]} />
      <Text variant="caption">{live ? 'Live' : status === 'connecting' ? '…' : 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

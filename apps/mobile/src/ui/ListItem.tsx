import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode; // a Cover, an Avatar, a position number…
  trailing?: ReactNode; // buttons, a chevron, a count…
  onPress?: () => void;
  onLongPress?: () => void;
  highlighted?: boolean; // e.g. the track playing now
  accessibilityLabel?: string;
};

// The row used by every list: events, playlists, tracks, people.
export function ListItem({ title, subtitle, leading, trailing, onPress, onLongPress, highlighted, accessibilityLabel }: Props) {
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text numberOfLines={1} style={highlighted && styles.highlightedTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress && !onLongPress) return <View style={[styles.row, highlighted && styles.highlighted]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [styles.row, highlighted && styles.highlighted, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  highlighted: { backgroundColor: colors.surface },
  highlightedTitle: { color: colors.accent, fontWeight: '700' },
  pressed: { backgroundColor: colors.surface },
  text: { flex: 1, gap: 2 },
});

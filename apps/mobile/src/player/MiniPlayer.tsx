import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/ui';
import { usePlayer } from './PlayerProvider';

// Above the tab bar on every screen while something plays: tap it to open
// the party / playlist it plays from.
export function MiniPlayer() {
  const p = usePlayer();
  if (!p.source || !p.track) return null;
  const { source, track } = p;
  const open = () =>
    router.push(
      source.kind === 'event'
        ? { pathname: '/events/[id]', params: { id: source.id } }
        : { pathname: '/playlists/[id]', params: { id: source.id } },
    );
  const progress = p.durationSec ? Math.min(1, p.positionSec / p.durationSec) : 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      <Pressable style={styles.row} onPress={open} accessibilityRole="button" accessibilityLabel={`Now playing ${track.title}. Open ${source.name}`}>
        {track.coverUrl ? <Image source={{ uri: track.coverUrl }} style={styles.cover} /> : <View style={styles.cover} />}
        <View style={styles.text}>
          <Text numberOfLines={1}>{track.title}</Text>
          <Text variant="muted" numberOfLines={1}>
            {track.artist} · {source.kind === 'event' ? 'party' : 'playlist'} {source.name}
          </Text>
        </View>
        <Pressable onPress={p.togglePause} hitSlop={10} accessibilityRole="button" accessibilityLabel={p.playing ? 'Pause' : 'Play'}>
          <Ionicons name={p.playing ? 'pause' : 'play'} size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={p.next} disabled={p.busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next track">
          <Ionicons name="play-skip-forward" size={24} color={p.busy ? colors.textMuted : colors.text} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  progress: { height: 2, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cover: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.border },
  text: { flex: 1 },
});

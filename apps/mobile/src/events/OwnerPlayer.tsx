import type { BroadcastTrack } from '@music-room/shared';
import { StyleSheet, View } from 'react-native';
import { toPlayerTrack, usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Text } from '@/ui';

type Props = {
  event: { id: string; name: string };
  nowPlaying: BroadcastTrack | null;
  queueLength: number;
};

// The owner's phone is the party's speaker. The audio itself lives in the
// app-wide player (PlayerProvider), so it keeps playing — and moving the
// queue on — whichever screen the owner goes to; this panel just drives it.
export function OwnerPlayer({ event, nowPlaying, queueLength }: Props) {
  const p = usePlayer();
  const source = { kind: 'event' as const, id: event.id, name: event.name };
  const here = p.source?.kind === 'event' && p.source.id === event.id;

  return (
    <View style={styles.panel}>
      <Text variant="muted">This phone is the speaker (you own the event)</Text>
      {here && p.track ? (
        <>
          <Text numberOfLines={1}>
            {p.playing ? '▶' : '⏸'} {p.track.title} — {p.track.artist}
          </Text>
          <Text variant="muted">
            {p.positionSec}s / {p.durationSec}s{p.buffering ? ' · buffering…' : ''}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title={p.playing ? 'Pause' : 'Resume'} variant="secondary" onPress={p.togglePause} />
            </View>
            <View style={styles.flex}>
              <Button title="Next" loading={p.busy} onPress={p.next} />
            </View>
          </View>
        </>
      ) : nowPlaying ? (
        // Something is "playing" for the party, but not on this phone (e.g. the app restarted).
        <Button title={`Play “${nowPlaying.title}” here`} onPress={() => p.playEvent(source, toPlayerTrack(nowPlaying))} />
      ) : (
        <Button
          title={queueLength ? 'Start the music' : 'Add a track to start'}
          disabled={!queueLength}
          loading={p.busy}
          onPress={() => p.playEvent(source, null)}
        />
      )}
      {here && p.error ? <Text variant="error">{p.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});

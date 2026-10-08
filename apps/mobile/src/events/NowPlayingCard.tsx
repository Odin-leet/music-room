import type { BroadcastTrack } from '@music-room/shared';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { toPlayerTrack, usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Cover, IconButton, Text } from '@/ui';

type Props = {
  event: { id: string; name: string };
  nowPlaying: BroadcastTrack | null;
  queueLength: number;
  isOwner: boolean;
};

// The top of a party's screen: what's playing for everyone. On the owner's
// phone it's also the speaker's controls — the audio itself lives in the
// app-wide player, so it keeps playing (and moving the queue on) whichever
// screen the owner goes to.
export function NowPlayingCard({ event, nowPlaying, queueLength, isOwner }: Props) {
  const p = usePlayer();
  const source = { kind: 'event' as const, id: event.id, name: event.name };
  const playingHere = isOwner && p.source?.kind === 'event' && p.source.id === event.id && !!p.track;
  const track = playingHere ? p.track : nowPlaying;

  if (!track) {
    return (
      <View style={[styles.card, styles.idle]}>
        <Ionicons name="musical-notes-outline" size={28} color={colors.accent} />
        <Text variant="muted" style={styles.flex}>
          {isOwner ? 'Nothing is playing yet. Your phone is the speaker.' : 'Nothing is playing yet.'}
        </Text>
        {isOwner ? (
          <Button
            title={queueLength ? 'Start' : 'Add tracks first'}
            icon="play"
            size="sm"
            disabled={!queueLength}
            loading={p.busy}
            onPress={() => p.playEvent(source, null)}
          />
        ) : null}
      </View>
    );
  }

  const progress = playingHere && p.durationSec ? Math.min(1, p.positionSec / p.durationSec) : 0;
  return (
    <View style={styles.card}>
      <Text variant="caption" style={styles.label}>
        NOW PLAYING{isOwner ? ' · YOUR PHONE IS THE SPEAKER' : ''}
      </Text>
      <View style={styles.row}>
        <Cover uri={track.coverUrl} size={96} />
        <View style={styles.flex}>
          <Text variant="heading" numberOfLines={2}>
            {track.title}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {track.artist}
          </Text>
          {nowPlaying?.suggestedBy ? <Text variant="caption">Suggested by {nowPlaying.suggestedBy.displayName}</Text> : null}
        </View>
      </View>

      {isOwner ? (
        playingHere ? (
          <>
            <View style={styles.bar} accessibilityLabel={`${p.positionSec} of ${p.durationSec} seconds`}>
              <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.controls}>
              <Text variant="caption">
                {p.positionSec}s / {p.durationSec}s{p.buffering ? ' · buffering…' : ''}
              </Text>
              <View style={styles.buttons}>
                <IconButton icon={p.playing ? 'pause' : 'play'} label={p.playing ? 'Pause' : 'Resume'} variant="filled" size={52} onPress={p.togglePause} />
                <IconButton icon="play-skip-forward" label="Next track" variant="tonal" size={44} disabled={p.busy} onPress={p.next} />
              </View>
            </View>
          </>
        ) : (
          // "Playing" for the party, but not on this phone (e.g. the app restarted).
          <Button title="Play it on this phone" icon="volume-high" size="sm" onPress={() => p.playEvent(source, toPlayerTrack(track))} />
        )
      ) : null}
      {playingHere && p.error ? <Text variant="error">{p.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  idle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { letterSpacing: 1, color: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.accent },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

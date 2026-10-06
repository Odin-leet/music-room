import type { BroadcastTrack, QueueBroadcast, TrackPreview } from '@music-room/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Text } from '@/ui';

type Props = {
  eventId: string;
  nowPlaying: BroadcastTrack | null;
  queueLength: number;
  // The /next response is the new queue: show it right away.
  onQueue: (queue: QueueBroadcast) => void;
};

// The owner's phone is the speaker: it plays the 30 s preview of the track
// that's "playing", and moves the queue on when it ends. Everyone else sees
// "Now playing" through the realtime updates.
export function OwnerPlayer({ eventId, nowPlaying, queueLength, onQueue }: Props) {
  const { authedApi } = useSession();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const advancing = useRef(false);

  // POST /next, saying which track we think is playing: if someone already
  // moved on, the server does nothing (so a double tap can't skip two songs).
  const next = async (current: string | null) => {
    if (advancing.current) return;
    advancing.current = true;
    setBusy(true);
    setError(null);
    try {
      onQueue(
        await authedApi<QueueBroadcast>(`/events/${eventId}/next`, {
          method: 'POST',
          body: { currentTrackId: current },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change track');
    } finally {
      advancing.current = false;
      setBusy(false);
    }
  };

  // A new track is playing: fetch a fresh preview link (they expire) and play it.
  useEffect(() => {
    const id = nowPlaying?.id ?? null;
    if (id === loadedFor.current) return;
    loadedFor.current = id;
    if (!nowPlaying) {
      player.pause();
      return;
    }
    let cancelled = false;
    authedApi<TrackPreview>(`/music/tracks/${nowPlaying.providerTrackId}/preview`).then(
      (preview) => {
        if (cancelled) return;
        player.replace({ uri: preview.url });
        player.play();
      },
      () => {
        if (!cancelled) setError('No preview for this track — skipping it');
        void next(id);
      },
    );
    return () => {
      cancelled = true;
    };
    // `next` and `player` are stable enough here; re-running on them would replay the track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.id]);

  // Preview finished: move the queue on by itself. Listening to the player's
  // own status events (not an effect on a status value) — refs give the
  // listener the current track and the current `next`.
  const nowPlayingRef = useRef(nowPlaying);
  const nextRef = useRef(next);
  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
    nextRef.current = next;
  });
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      const current = nowPlayingRef.current;
      if (s.didJustFinish && current) void nextRef.current(current.id);
    });
    return () => sub.remove();
  }, [player]);

  const seconds = Math.floor(status.currentTime);
  const total = Math.round(status.duration || 30);

  return (
    <View style={styles.panel}>
      <Text variant="muted">This phone is the speaker (you own the event)</Text>
      {nowPlaying ? (
        <>
          <Text numberOfLines={1}>
            {status.playing ? '▶' : '⏸'} {nowPlaying.title} — {nowPlaying.artist}
          </Text>
          <Text variant="muted">
            {seconds}s / {total}s{status.isBuffering ? ' · buffering…' : ''}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                title={status.playing ? 'Pause' : 'Resume'}
                variant="secondary"
                onPress={() => (status.playing ? player.pause() : player.play())}
              />
            </View>
            <View style={styles.flex}>
              <Button title="Next" loading={busy} onPress={() => void next(nowPlaying.id)} />
            </View>
          </View>
        </>
      ) : (
        <Button
          title={queueLength ? 'Start the music' : 'Add a track to start'}
          disabled={!queueLength}
          loading={busy}
          onPress={() => void next(null)}
        />
      )}
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});

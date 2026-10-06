import type { PlaylistTrackView, TrackPreview } from '@music-room/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Text } from '@/ui';

type Props = {
  tracks: PlaylistTrackView[]; // in playlist order
  playingId: string | null;
  onPlayingChange: (trackId: string | null) => void;
};

// Plays the playlist's 30 s previews on THIS phone, in order. Unlike Track
// Vote there's no shared speaker: everyone listens on their own device, and
// the order they hear follows the live list (a track moved while playing
// changes what comes next).
export function PlaylistPlayer({ tracks, playingId, onPlayingChange }: Props) {
  const { authedApi } = useSession();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);

  // The listener below needs the latest list and current track.
  const tracksRef = useRef(tracks);
  const playingRef = useRef(playingId);
  const lastIndex = useRef(0);
  useEffect(() => {
    tracksRef.current = tracks;
    playingRef.current = playingId;
    const i = tracks.findIndex((t) => t.id === playingId);
    if (i >= 0) lastIndex.current = i;
  });

  // The track after the current one; if the current one was just removed,
  // the one now at its old place.
  const nextAfter = (id: string | null) => {
    const list = tracksRef.current;
    const i = list.findIndex((t) => t.id === id);
    const next = i >= 0 ? list[i + 1] : list[lastIndex.current];
    return next?.id ?? null;
  };

  const current = tracks.find((t) => t.id === playingId) ?? null;
  const providerTrackId = current?.providerTrackId ?? null;

  // A new track to play: fetch a fresh preview link (they expire) and play it.
  useEffect(() => {
    if (!providerTrackId) {
      player.pause();
      return;
    }
    let cancelled = false;
    authedApi<TrackPreview>(`/music/tracks/${providerTrackId}/preview`).then(
      (preview) => {
        if (cancelled) return;
        setError(null);
        player.replace({ uri: preview.url });
        player.play();
      },
      () => {
        if (cancelled) return;
        setError('No preview for this track — skipping it');
        onPlayingChange(nextAfter(playingRef.current));
      },
    );
    return () => {
      cancelled = true;
    };
    // Only a different track restarts playback (not a re-render or a move).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, providerTrackId]);

  // Preview finished: go on to the next track in the (live) order.
  const onChangeRef = useRef(onPlayingChange);
  useEffect(() => {
    onChangeRef.current = onPlayingChange;
  });
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish && playingRef.current) onChangeRef.current(nextAfter(playingRef.current));
    });
    return () => sub.remove();
  }, [player]);

  if (!tracks.length) return null;

  if (!current) {
    return (
      <View style={styles.panel}>
        <Button title="▶ Play from the top" onPress={() => onPlayingChange(tracks[0].id)} />
        {error ? <Text variant="error">{error}</Text> : null}
      </View>
    );
  }

  const seconds = Math.floor(status.currentTime);
  const total = Math.round(status.duration || 30);
  return (
    <View style={styles.panel}>
      <Text numberOfLines={1}>
        {status.playing ? '▶' : '⏸'} {current.title} — {current.artist}
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
          <Button title="Next" onPress={() => onPlayingChange(nextAfter(current.id))} />
        </View>
        <View style={styles.flex}>
          <Button title="Stop" variant="secondary" onPress={() => onPlayingChange(null)} />
        </View>
      </View>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});

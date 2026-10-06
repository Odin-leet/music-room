// TEMPORARY (music provider experiment): search Deezer through our API and
// play a 30 s preview. Replaced by the real Track Vote / Playlist screens.
import type { TrackPreview, TrackSummary } from '@music-room/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Screen, Text, TextField } from '@/ui';

export default function MusicTestScreen() {
  const { authedApi } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<TrackSummary | null>(null);

  // One player for the screen; released automatically when it unmounts.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await authedApi<TrackSummary[]>(`/music/search?q=${encodeURIComponent(query.trim())}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const play = async (track: TrackSummary) => {
    setError(null);
    try {
      // Fresh signed link every time: Deezer's previews expire after ~15 min.
      const preview = await authedApi<TrackPreview>(`/music/tracks/${track.providerTrackId}/preview`);
      player.replace({ uri: preview.url });
      player.play();
      setNowPlaying(track);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not play this track');
    }
  };

  return (
    <Screen>
      <Text variant="title">Music test</Text>
      <TextField
        label="Search Deezer"
        placeholder="Artist or song"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => void search()}
        autoCorrect={false}
      />
      <Button title="Search" loading={searching} onPress={() => void search()} />
      {error ? <Text variant="error">{error}</Text> : null}

      {nowPlaying ? (
        <View style={styles.player}>
          <Text numberOfLines={1}>
            {status.playing ? '▶' : '⏸'} {nowPlaying.title} — {nowPlaying.artist}
          </Text>
          <Text variant="muted">
            {Math.floor(status.currentTime)}s / {Math.round(status.duration || 30)}s
            {status.isBuffering ? ' · buffering…' : ''}
          </Text>
          <Button
            title={status.playing ? 'Pause' : 'Resume'}
            variant="secondary"
            onPress={() => (status.playing ? player.pause() : player.play())}
          />
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(t) => t.providerTrackId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => void play(item)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${item.title} by ${item.artist}`}
          >
            {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.cover} /> : null}
            <View style={styles.rowText}>
              <Text numberOfLines={1}>{item.title}</Text>
              <Text variant="muted" numberOfLines={1}>
                {item.artist} · {Math.floor(item.durationSec / 60)}:
                {String(item.durationSec % 60).padStart(2, '0')}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cover: { width: 48, height: 48, borderRadius: radius.sm },
  rowText: { flex: 1 },
});

import type { PlaylistTrackView, TrackSummary } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Screen, Text, TextField } from '@/ui';

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type RowState = 'adding' | 'added' | 'already';

// Search Deezer (through our API) and add tracks to the end of the playlist.
// Stays open, so several tracks can be added in a row.
export default function AddPlaylistTracksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await authedApi<TrackSummary[]>(`/music/search?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const mark = (trackId: string, state: RowState | null) =>
    setRows((r) => {
      const next = { ...r };
      if (state) next[trackId] = state;
      else delete next[trackId];
      return next;
    });

  const add = async (track: TrackSummary) => {
    if (rows[track.providerTrackId]) return;
    mark(track.providerTrackId, 'adding');
    setError(null);
    try {
      await authedApi<PlaylistTrackView>(`/playlists/${id}/tracks`, {
        method: 'POST',
        body: { providerTrackId: track.providerTrackId },
      });
      mark(track.providerTrackId, 'added');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        mark(track.providerTrackId, 'already');
      } else {
        mark(track.providerTrackId, null);
        setError(err instanceof ApiError ? err.message : 'Could not add this track');
      }
    }
  };

  const added = Object.values(rows).filter((s) => s === 'added').length;
  const label: Record<RowState, string> = { adding: 'Adding…', added: '✓ Added', already: 'Already in' };

  return (
    <Screen>
      <Text variant="title">Add tracks</Text>
      <TextField
        label="Search"
        placeholder="Artist or song"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => void search()}
      />
      <Button title="Search" loading={searching} disabled={!query.trim()} onPress={() => void search()} />
      {error ? <Text variant="error">{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(t) => t.providerTrackId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const state = rows[item.providerTrackId];
          return (
            <Pressable
              style={styles.row}
              disabled={!!state}
              onPress={() => void add(item)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.title} by ${item.artist}`}
            >
              {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.cover} /> : <View style={styles.cover} />}
              <View style={styles.rowText}>
                <Text numberOfLines={1}>{item.title}</Text>
                <Text variant="muted" numberOfLines={1}>
                  {item.artist} · {duration(item.durationSec)}
                </Text>
              </View>
              <Text variant={state === 'added' ? 'success' : 'muted'}>{state ? label[state] : '+ Add'}</Text>
            </Pressable>
          );
        }}
      />
      <Button title={added ? `Done (${added} added)` : 'Done'} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cover: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  rowText: { flex: 1 },
});

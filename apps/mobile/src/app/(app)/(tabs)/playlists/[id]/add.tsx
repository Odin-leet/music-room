import type { PlaylistTrackView, TrackSummary } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Screen, Text, TextField, ScreenHeader, Cover, ListItem } from '@/ui';

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
      <ScreenHeader back title="Add tracks" />
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
            <ListItem
              title={item.title}
              subtitle={state === 'already' ? `${item.artist} · already in the playlist` : `${item.artist} · ${duration(item.durationSec)}`}
              leading={<Cover uri={item.coverUrl} size={48} />}
              trailing={
                state === 'adding' ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons
                    name={state === 'added' ? 'checkmark-circle' : state === 'already' ? 'checkmark-done-circle-outline' : 'add-circle'}
                    size={28}
                    color={state === 'added' ? colors.success : state === 'already' ? colors.textMuted : colors.accent}
                  />
                )
              }
              onPress={state ? undefined : () => void add(item)}
              accessibilityLabel={`${state ? label[state] : "Add"}: ${item.title} by ${item.artist}`}
            />
          );
        }}
      />
      <Button title={added ? `Done (${added} added)` : 'Done'} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});

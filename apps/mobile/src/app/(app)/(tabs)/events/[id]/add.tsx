import type { TrackSummary } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { getCurrentCoords, LocationError } from '@/events/location';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Button, Screen, Text, TextField } from '@/ui';

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Search Deezer (through our API) and suggest a track to the event's queue.
export default function AddTrackScreen() {
  const { id, geo } = useLocalSearchParams<{ id: string; geo?: string }>();
  const { authedApi } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
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

  const add = async (track: TrackSummary) => {
    setAdding(track.providerTrackId);
    setError(null);
    try {
      // Geo events check where you are for suggestions too.
      const at = geo ? await getCurrentCoords() : null;
      await authedApi(`/events/${id}/tracks`, {
        method: 'POST',
        body: { providerTrackId: track.providerTrackId, ...(at ?? {}) },
      });
      router.back(); // the queue screen refreshes (and everyone else gets it live)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof LocationError ? err.message : 'Could not add this track');
      setAdding(null);
    }
  };

  return (
    <Screen>
      <Text variant="title">Add a track</Text>
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
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={adding !== null}
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
            <Text variant="muted">{adding === item.providerTrackId ? 'Adding…' : '+ Add'}</Text>
          </Pressable>
        )}
      />
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cover: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  rowText: { flex: 1 },
});

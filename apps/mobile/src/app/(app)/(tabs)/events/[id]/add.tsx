import type { TrackSummary } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { getCurrentCoords, LocationError } from '@/events/location';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Screen, Text, TextField, ScreenHeader, Cover, ListItem } from '@/ui';

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
      <ScreenHeader back title="Add a track" />
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
          <ListItem
            title={item.title}
            subtitle={`${item.artist} · ${duration(item.durationSec)}`}
            leading={<Cover uri={item.coverUrl} size={48} />}
            trailing={
              adding === item.providerTrackId ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="add-circle" size={28} color={colors.accent} />
              )
            }
            onPress={adding === null ? () => void add(item) : undefined}
            accessibilityLabel={`Suggest ${item.title} by ${item.artist}`}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});

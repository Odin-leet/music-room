import type { PlaylistTracksView, PlaylistView } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { playlistSubtitle } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

// A playlist's tracks. For now read-only; editing (drag to reorder, add,
// remove) and live updates come next.
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [tracks, setTracks] = useState<PlaylistTracksView['tracks'] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        authedApi<PlaylistView>(`/playlists/${id}`),
        authedApi<PlaylistTracksView>(`/playlists/${id}/tracks`),
      ]);
      setPlaylist(p);
      setTracks(t.tracks);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the playlist');
    }
  }, [authedApi, id]);

  // Back from the info screen: name, settings or membership may have changed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!playlist) {
    return (
      <Screen centered>
        <Text variant={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title" numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {playlistSubtitle(playlist)}
          </Text>
        </View>
        <Button
          title="Info"
          variant="secondary"
          onPress={() => router.push({ pathname: '/playlists/[id]/info', params: { id: playlist.id } })}
        />
      </View>
      {error ? <Text variant="error">{error}</Text> : null}

      <FlatList
        data={tracks ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={tracks ? <Text variant="muted">No tracks yet.</Text> : null}
        renderItem={({ item, index }) => (
          <View accessible accessibilityLabel={`${index + 1}. ${item.title} by ${item.artist}`}>
            <Card>
              <Text numberOfLines={1}>
                {index + 1}. {item.title}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                {item.artist}
                {item.addedBy ? ` · added by ${item.addedBy.displayName}` : ''}
              </Text>
            </Card>
          </View>
        )}
      />
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  list: { gap: spacing.md },
});

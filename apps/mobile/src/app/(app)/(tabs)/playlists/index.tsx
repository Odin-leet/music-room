import type { PlaylistView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { playlistSubtitle } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

// Public playlists + the ones I belong to, most recently edited first.
export default function PlaylistsScreen() {
  const { authedApi } = useSession();
  const [playlists, setPlaylists] = useState<PlaylistView[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlaylists(await authedApi<PlaylistView[]>('/playlists'));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load playlists');
    }
  }, [authedApi]);

  // Reload every time the screen comes back into view (after create / join / edit / delete).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <Text variant="title">Playlists</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Create" onPress={() => router.push('/playlists/new')} />
        </View>
        <View style={styles.action}>
          <Button title="Join with code" variant="secondary" onPress={() => router.push('/playlists/join')} />
        </View>
      </View>
      {error ? <Text variant="error">{error}</Text> : null}

      <FlatList
        data={playlists ?? []}
        keyExtractor={(p) => p.id}
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
        ListEmptyComponent={
          playlists ? <Text variant="muted">No playlists yet. Create one, or join with a code.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/playlists/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open playlist ${item.name}`}
          >
            <Card>
              <Text numberOfLines={1}>
                {item.visibility === 'private' ? '🔒 ' : ''}
                {item.name}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                {playlistSubtitle(item)} · by {item.owner.displayName}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  list: { gap: spacing.md },
});

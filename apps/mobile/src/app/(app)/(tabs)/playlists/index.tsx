import type { PlaylistView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { playlistSubtitle } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Cover, EmptyState, IconButton, ListItem, Screen, ScreenHeader, Text } from '@/ui';

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
      <ScreenHeader
        title="Playlists"
        right={
          <>
            <IconButton icon="key-outline" label="Join with a code" variant="tonal" onPress={() => router.push('/playlists/join')} />
            <IconButton icon="add" label="Create a playlist" variant="filled" onPress={() => router.push('/playlists/new')} />
          </>
        }
      />
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
          playlists ? (
            <EmptyState
              icon="musical-notes-outline"
              title="No playlists yet"
              text="Create one, or join a friend's with its code."
              action="Create a playlist"
              onAction={() => router.push('/playlists/new')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ListItem
            title={`${item.visibility === 'private' ? '🔒 ' : ''}${item.name}`}
            subtitle={`${playlistSubtitle(item)} · by ${item.owner.displayName}`}
            leading={<Cover uris={item.covers} uri={item.covers[0]} size={56} icon="musical-notes" />}
            trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            onPress={() => router.push({ pathname: '/playlists/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs, paddingBottom: spacing.lg },
});

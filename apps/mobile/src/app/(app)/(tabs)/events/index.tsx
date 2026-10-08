import type { EventView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { eventSubtitle } from '@/events/labels';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Cover, EmptyState, IconButton, ListItem, Screen, ScreenHeader, Text } from '@/ui';

// Public events + the ones I belong to.
export default function EventsScreen() {
  const { authedApi } = useSession();
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await authedApi<EventView[]>('/events'));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load events');
    }
  }, [authedApi]);

  // Reload every time the screen comes back into view (after create / join / delete).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ScreenHeader
        title="Events"
        right={
          <>
            <IconButton icon="key-outline" label="Join with a code" variant="tonal" onPress={() => router.push('/events/join')} />
            <IconButton icon="add" label="Create an event" variant="filled" onPress={() => router.push('/events/new')} />
          </>
        }
      />
      {error ? <Text variant="error">{error}</Text> : null}

      <FlatList
        data={events ?? []}
        keyExtractor={(e) => e.id}
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
          events ? (
            <EmptyState
              icon="people-outline"
              title="No events yet"
              text="Create one, or join a friend's with its code."
              action="Create an event"
              onAction={() => router.push('/events/new')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ListItem
            title={`${item.visibility === 'private' ? '🔒 ' : ''}${item.name}`}
            subtitle={`${eventSubtitle(item)} · by ${item.owner.displayName}`}
            leading={<Cover uri={item.cover} size={56} icon="people" />}
            trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs, paddingBottom: spacing.lg },
});

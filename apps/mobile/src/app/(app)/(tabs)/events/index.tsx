import type { EventView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { eventSubtitle } from '@/events/labels';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

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
      <Text variant="title">Events</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Create" onPress={() => router.push('/events/new')} />
        </View>
        <View style={styles.action}>
          <Button title="Join with code" variant="secondary" onPress={() => router.push('/events/join')} />
        </View>
      </View>
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
          events ? <Text variant="muted">No events yet. Create one, or join with a code.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open event ${item.name}`}
          >
            <Card>
              <Text numberOfLines={1}>{item.name}</Text>
              <Text variant="muted" numberOfLines={1}>
                {eventSubtitle(item)} · by {item.owner.displayName}
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

import type { EventView, PlaylistView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { eventSubtitle } from '@/events/labels';
import { playlistSubtitle } from '@/playlists/labels';
import { useIncomingRequests } from '@/profile/MeRealtimeProvider';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

const SHOW = 3; // items per section; "See all" opens the tab

// What's going on: friend requests waiting, events to join, my playlists.
// Each section links to its tab.
export default function HomeScreen() {
  const { authedApi } = useSession();
  const { me } = useCurrentUser();
  const incoming = useIncomingRequests();
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistView[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      authedApi<EventView[]>('/events').catch(() => null),
      authedApi<PlaylistView[]>('/playlists').catch(() => null),
    ]);
    setEvents(e);
    // "Mine" first: the ones I own or joined, then public ones.
    setPlaylists(p ? [...p].sort((a, b) => Number(!!b.myRole) - Number(!!a.myRole)) : null);
  }, [authedApi]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const name = me.state === 'ok' ? me.user.displayName : '';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
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
      >
        <Text variant="title">Hi{name ? `, ${name}` : ''}</Text>

        {incoming ? (
          <Pressable onPress={() => router.push('/people/friends')} accessibilityRole="button">
            <Card>
              <Text>
                {incoming} friend request{incoming > 1 ? 's' : ''} waiting
              </Text>
              <Text variant="muted">Tap to answer</Text>
            </Card>
          </Pressable>
        ) : null}

        <Section title="Events" onSeeAll={() => router.push('/events')}>
          {events?.length ? (
            events.slice(0, SHOW).map((e) => (
              <Row
                key={e.id}
                title={e.name}
                subtitle={eventSubtitle(e)}
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
              />
            ))
          ) : events ? (
            <Text variant="muted">No events yet.</Text>
          ) : null}
          <Button title="Create an event" variant="secondary" onPress={() => router.push('/events/new')} />
        </Section>

        <Section title="Playlists" onSeeAll={() => router.push('/playlists')}>
          {playlists?.length ? (
            playlists.slice(0, SHOW).map((p) => (
              <Row
                key={p.id}
                title={p.name}
                subtitle={playlistSubtitle(p)}
                onPress={() => router.push({ pathname: '/playlists/[id]', params: { id: p.id } })}
              />
            ))
          ) : playlists ? (
            <Text variant="muted">No playlists yet.</Text>
          ) : null}
          <Button title="Create a playlist" variant="secondary" onPress={() => router.push('/playlists/new')} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text variant="muted">See all</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Row({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
      <Card>
        <Text numberOfLines={1}>{title}</Text>
        <Text variant="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
});

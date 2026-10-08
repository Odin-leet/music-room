import { Ionicons } from '@expo/vector-icons';
import type { EventView, PlaylistView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { eventSubtitle } from '@/events/labels';
import { playlistSubtitle } from '@/playlists/labels';
import { useIncomingRequests } from '@/profile/MeRealtimeProvider';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Avatar, Cover, type IconName, Screen, ScreenHeader, SectionHeader, Text } from '@/ui';

const SHOW = 8; // cards per row; "See all" opens the tab
const CARD = 148;

// What's going on: friend requests waiting, events to join, playlists.
// Each row of cards links to its tab.
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
    // Mine first (owned or joined), then public ones.
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
        showsVerticalScrollIndicator={false}
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
        <ScreenHeader
          title={name ? `Hi, ${name.split(' ')[0]}` : 'Music Room'}
          subtitle="What are we listening to?"
          right={
            <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="My profile">
              <Avatar name={name || '?'} size={40} />
            </Pressable>
          }
        />

        {incoming ? (
          <Pressable
            onPress={() => router.push('/people/friends')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
          >
            <Ionicons name="person-add" size={20} color={colors.onPrimary} />
            <Text style={styles.bannerText}>
              {incoming} friend request{incoming > 1 ? 's' : ''} waiting
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
          </Pressable>
        ) : null}

        <View>
          <SectionHeader title="Events" action="See all" onAction={() => router.push('/events')} />
          <Row>
            {(events ?? []).slice(0, SHOW).map((e) => (
              <HomeCard
                key={e.id}
                title={e.name}
                subtitle={eventSubtitle(e)}
                cover={<Cover uri={e.cover} size={CARD} icon="people" />}
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
              />
            ))}
            <NewCard icon="add" label="New event" onPress={() => router.push('/events/new')} />
          </Row>
        </View>

        <View>
          <SectionHeader title="Playlists" action="See all" onAction={() => router.push('/playlists')} />
          <Row>
            {(playlists ?? []).slice(0, SHOW).map((p) => (
              <HomeCard
                key={p.id}
                title={p.name}
                subtitle={playlistSubtitle(p)}
                cover={<Cover uris={p.covers} uri={p.covers[0]} size={CARD} icon="musical-notes" />}
                onPress={() => router.push({ pathname: '/playlists/[id]', params: { id: p.id } })}
              />
            ))}
            <NewCard icon="add" label="New playlist" onPress={() => router.push('/playlists/new')} />
          </Row>
        </View>
      </ScrollView>
    </Screen>
  );
}

// A horizontal row of cards, bleeding to the screen edges.
function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.rowScroll}>
      {children}
    </ScrollView>
  );
}

function HomeCard({ title, subtitle, cover, onPress }: { title: string; subtitle: string; cover: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {cover}
      <Text numberOfLines={1} style={styles.cardTitle}>
        {title}
      </Text>
      <Text variant="caption" numberOfLines={2}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function NewCard({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.newCover}>
        <Ionicons name={icon} size={40} color={colors.accent} />
      </View>
      <Text style={styles.cardTitle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  bannerText: { flex: 1, color: colors.onPrimary, fontWeight: '700' },
  rowScroll: { marginHorizontal: -spacing.xl, marginTop: spacing.md },
  row: { gap: spacing.md, paddingHorizontal: spacing.xl },
  card: { width: CARD, gap: 4 },
  cardTitle: { fontWeight: '700', marginTop: spacing.xs },
  newCover: {
    width: CARD,
    height: CARD,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

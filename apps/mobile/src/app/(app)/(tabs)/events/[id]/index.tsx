import type { BroadcastTrack, EventView, QueueTrack, QueueView, VoteResult } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { DENY_MESSAGE, eventSubtitle } from '@/events/labels';
import { getCurrentCoords, LocationError, type Coords } from '@/events/location';
import { NowPlayingCard } from '@/events/NowPlayingCard';
import { usePlayer } from '@/player/PlayerProvider';
import { useEventRealtime } from '@/events/useEventRealtime';
import { useSession } from '@/session/SessionProvider';
import { colors, font, radius, spacing } from '@/theme';
import { Button, Cover, EmptyState, IconButton, ListItem, ScreenHeader, SectionHeader, Text } from '@/ui';

// The server's ranking rule, applied locally right after an optimistic vote
// so the list reorders instantly; the next broadcast confirms it.
const byRank = (a: QueueTrack, b: QueueTrack) =>
  b.score - a.score || a.suggestedAt.localeCompare(b.suggestedAt) || a.id.localeCompare(b.id);

export default function EventQueueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [event, setEvent] = useState<EventView | null>(null);
  const [upcoming, setUpcoming] = useState<QueueTrack[]>([]);
  const [nowPlaying, setNowPlaying] = useState<BroadcastTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Broadcasts are the same for everyone, so "did I vote for it" is kept here:
  // from GET /queue, then from my own vote / unvote responses.
  const myVotes = useRef(new Set<string>());
  // Geo events: where I am, sent with every vote once shared.
  const coords = useRef<Coords | null>(null);
  const eventRef = useRef<EventView | null>(null);

  // Takes either the REST queue or a broadcast; votedByMe always comes from myVotes.
  const { onEventQueue } = usePlayer();
  const applyQueue = useCallback(
    (q: { nowPlaying: BroadcastTrack | null; upcoming: BroadcastTrack[] }) => {
      setNowPlaying(q.nowPlaying);
      setUpcoming(q.upcoming.map((t) => ({ ...t, votedByMe: myVotes.current.has(t.id) })));
      onEventQueue(id, q); // if this phone plays the party, follow its "now playing"
    },
    [id, onEventQueue],
  );

  const load = useCallback(async () => {
    try {
      const at = coords.current;
      const [e, q] = await Promise.all([
        authedApi<EventView>(`/events/${id}${at ? `?lat=${at.lat}&lng=${at.lng}` : ''}`),
        authedApi<QueueView>(`/events/${id}/queue`),
      ]);
      myVotes.current = new Set(q.upcoming.filter((t) => t.votedByMe).map((t) => t.id));
      eventRef.current = e;
      setEvent(e);
      applyQueue(q);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the event');
    }
  }, [authedApi, id, applyQueue]);

  // Reload when coming back (e.g. from Add track or Info).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const live = useEventRealtime(id, {
    onQueue: applyQueue,
    onEventUpdated: () => void load(),
    onJoined: () => void load(),
    onGone: (why) => {
      Alert.alert(
        why === 'deleted' ? 'Event deleted' : 'Event unavailable',
        why === 'deleted' ? 'The organiser deleted this event.' : 'You no longer have access to this event.',
      );
      router.dismissTo('/events');
    },
  });

  const shareLocation = async () => {
    setLocating(true);
    try {
      coords.current = await getCurrentCoords();
      await load();
    } catch (err) {
      setError(err instanceof LocationError ? err.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const toggleVote = async (track: QueueTrack) => {
    const voting = !track.votedByMe;
    // Optimistic: flip it now, reorder, then take the server's numbers.
    const flip = (t: QueueTrack, on: boolean, delta: number) => ({ ...t, votedByMe: on, score: t.score + delta });
    if (voting) myVotes.current.add(track.id);
    else myVotes.current.delete(track.id);
    setUpcoming((list) => list.map((t) => (t.id === track.id ? flip(t, voting, voting ? 1 : -1) : t)).sort(byRank));
    setError(null);

    const at = eventRef.current?.license === 'geo' ? coords.current : null;
    const path = `/events/${id}/tracks/${track.id}/vote`;
    try {
      const res = voting
        ? await authedApi<VoteResult>(path, { method: 'POST', body: at ?? {} })
        : await authedApi<VoteResult>(at ? `${path}?lat=${at.lat}&lng=${at.lng}` : path, { method: 'DELETE' });
      setUpcoming((list) => list.map((t) => (t.id === res.trackId ? { ...t, score: res.score } : t)).sort(byRank));
    } catch (err) {
      // Undo the optimistic change.
      if (voting) myVotes.current.delete(track.id);
      else myVotes.current.add(track.id);
      setUpcoming((list) => list.map((t) => (t.id === track.id ? flip(t, !voting, voting ? -1 : 1) : t)).sort(byRank));
      setError(err instanceof ApiError ? err.message : 'Your vote did not go through');
    }
  };

  if (!event) {
    return (
      <SafeAreaView style={styles.center}>
        <Text variant={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const canVote = event.participation.allowed;
  const needsLocation =
    !event.participation.allowed &&
    (event.participation.reason === 'location_required' || event.participation.reason === 'outside_area');
  const addTrack = () =>
    router.push({ pathname: '/events/[id]/add', params: { id: event.id, geo: event.license === 'geo' ? '1' : '' } });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        contentContainerStyle={styles.content}
        data={upcoming}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              back
              title={event.name}
              subtitle={eventSubtitle(event)}
              right={
                <>
                  <LiveDot status={live} />
                  <IconButton
                    icon="information-circle-outline"
                    label="Event info and invite"
                    onPress={() => router.push({ pathname: '/events/[id]/info', params: { id: event.id } })}
                  />
                </>
              }
            />

            {canVote ? null : (
              <View style={styles.notice}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <Text variant="muted" style={styles.flex}>
                  {DENY_MESSAGE[event.participation.reason]}
                </Text>
              </View>
            )}
            {needsLocation ? (
              <Button title="Share my location" icon="location-outline" variant="secondary" loading={locating} onPress={() => void shareLocation()} />
            ) : null}

            <NowPlayingCard event={event} nowPlaying={nowPlaying} queueLength={upcoming.length} isOwner={event.myRole === 'owner'} />

            {error ? <Text variant="error">{error}</Text> : null}
            <SectionHeader title={`Up next${upcoming.length ? ` · ${upcoming.length}` : ''}`} action={canVote ? '+ Add' : undefined} onAction={addTrack} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title="The queue is empty"
            text={canVote ? 'Suggest the first track, then vote for what plays next.' : 'Tracks will show up here.'}
            action={canVote ? 'Add a track' : undefined}
            onAction={addTrack}
          />
        }
        renderItem={({ item, index }) => (
          <ListItem
            title={item.title}
            subtitle={`${item.artist}${item.suggestedBy ? ` · ${item.suggestedBy.displayName}` : ''}`}
            leading={
              <View style={styles.leading}>
                <Text variant="caption" style={styles.position}>
                  {index + 1}
                </Text>
                <Cover uri={item.coverUrl} size={48} />
              </View>
            }
            trailing={<VoteButton track={item} canVote={canVote} onPress={() => void toggleVote(item)} />}
          />
        )}
      />
    </SafeAreaView>
  );
}

function LiveDot({ status }: { status: 'connecting' | 'live' | 'offline' }) {
  const live = status === 'live';
  return (
    <View style={styles.live} accessibilityLabel={`Live updates: ${status}`}>
      <View style={[styles.dot, { backgroundColor: live ? colors.success : colors.textMuted }]} />
      <Text variant="caption">{live ? 'Live' : status === 'connecting' ? '…' : 'Offline'}</Text>
    </View>
  );
}

// A pill with the vote count; filled when you've voted. Tap again to remove.
function VoteButton({ track, canVote, onPress }: { track: QueueTrack; canVote: boolean; onPress: () => void }) {
  const on = track.votedByMe;
  return (
    <Pressable
      onPress={onPress}
      disabled={!canVote}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !canVote }}
      accessibilityLabel={`${on ? 'Remove vote for' : 'Vote for'} ${track.title}, ${track.score} votes`}
      style={({ pressed }) => [styles.vote, on && styles.voteOn, !canVote && styles.voteDisabled, pressed && styles.pressed]}
    >
      <Ionicons name={on ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={20} color={on ? colors.onPrimary : colors.accent} />
      <Text style={[styles.voteText, on && styles.voteTextOn]}>{track.score}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  header: { gap: spacing.lg, marginBottom: spacing.xs },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  leading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  position: { width: 18, textAlign: 'right' },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  voteOn: { backgroundColor: colors.primary },
  voteDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  voteText: { color: colors.text, fontWeight: font.weight.bold },
  voteTextOn: { color: colors.onPrimary },
});

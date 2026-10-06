import type { BroadcastTrack, EventView, QueueTrack, QueueView, VoteResult } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { DENY_MESSAGE, eventSubtitle } from '@/events/labels';
import { getCurrentCoords, LocationError, type Coords } from '@/events/location';
import { useEventRealtime } from '@/events/useEventRealtime';
import { useSession } from '@/session/SessionProvider';
import { colors, font, radius, spacing } from '@/theme';
import { Button, Text } from '@/ui';

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
  const applyQueue = useCallback((q: { nowPlaying: BroadcastTrack | null; upcoming: BroadcastTrack[] }) => {
    setNowPlaying(q.nowPlaying);
    setUpcoming(q.upcoming.map((t) => ({ ...t, votedByMe: myVotes.current.has(t.id) })));
  }, []);

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
      <View style={styles.center}>
        <Text variant={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const canVote = event.participation.allowed;
  const needsLocation =
    !event.participation.allowed &&
    (event.participation.reason === 'location_required' || event.participation.reason === 'outside_area');

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={upcoming}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="title" style={styles.title} numberOfLines={2}>
              {event.name}
            </Text>
            <Text variant={live === 'live' ? 'success' : 'muted'} accessibilityLabel={`Live updates: ${live}`}>
              {live === 'live' ? '● Live' : live === 'connecting' ? '○ Connecting' : '○ Offline'}
            </Text>
          </View>
          <Text variant="muted">{eventSubtitle(event)}</Text>

          {canVote ? null : <Text variant="error">{DENY_MESSAGE[event.participation.reason]}</Text>}
          {needsLocation ? (
            <Button title="Share my location" variant="secondary" loading={locating} onPress={() => void shareLocation()} />
          ) : null}

          <View style={styles.actions}>
            {canVote ? (
              <View style={styles.action}>
                <Button
                  title="Add track"
                  onPress={() =>
                    router.push({ pathname: '/events/[id]/add', params: { id: event.id, geo: event.license === 'geo' ? '1' : '' } })
                  }
                />
              </View>
            ) : null}
            <View style={styles.action}>
              <Button
                title="Info & invite"
                variant="secondary"
                onPress={() => router.push({ pathname: '/events/[id]/info', params: { id: event.id } })}
              />
            </View>
          </View>
          {error ? <Text variant="error">{error}</Text> : null}

          {nowPlaying ? (
            <View style={styles.nowPlaying}>
              <Text variant="muted">Now playing</Text>
              <Text numberOfLines={1}>
                {nowPlaying.title} — {nowPlaying.artist}
              </Text>
            </View>
          ) : null}
          <Text style={styles.sectionLabel}>Up next</Text>
        </View>
      }
      ListEmptyComponent={
        <Text variant="muted">{canVote ? 'The queue is empty. Add the first track!' : 'The queue is empty.'}</Text>
      }
      renderItem={({ item, index }) => (
        <TrackRow track={item} position={index + 1} canVote={canVote} onVote={() => void toggleVote(item)} />
      )}
      ListFooterComponent={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
    />
  );
}

function TrackRow({
  track,
  position,
  canVote,
  onVote,
}: {
  track: QueueTrack;
  position: number;
  canVote: boolean;
  onVote: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text variant="muted" style={styles.position}>
        {position}
      </Text>
      {track.coverUrl ? <Image source={{ uri: track.coverUrl }} style={styles.cover} /> : <View style={styles.cover} />}
      <View style={styles.rowText}>
        <Text numberOfLines={1}>{track.title}</Text>
        <Text variant="muted" numberOfLines={1}>
          {track.artist}
          {track.suggestedBy ? ` · added by ${track.suggestedBy.displayName}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onVote}
        disabled={!canVote}
        accessibilityRole="button"
        accessibilityState={{ selected: track.votedByMe, disabled: !canVote }}
        accessibilityLabel={`${track.votedByMe ? 'Remove vote for' : 'Vote for'} ${track.title}, ${track.score} votes`}
        style={[styles.vote, track.votedByMe && styles.voteOn, !canVote && styles.voteDisabled]}
      >
        <Text style={[styles.voteText, track.votedByMe && styles.voteTextOn]}>▲ {track.score}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xxl * 1.5, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  nowPlaying: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.xs },
  sectionLabel: { fontSize: font.size.sm, fontWeight: font.weight.bold, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  position: { width: 20, textAlign: 'right' },
  cover: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  rowText: { flex: 1 },
  vote: {
    minWidth: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  voteOn: { backgroundColor: colors.primary },
  voteDisabled: { opacity: 0.4 },
  voteText: { color: colors.primary, fontWeight: font.weight.bold },
  voteTextOn: { color: colors.onPrimary },
});

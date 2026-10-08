import type { FriendRequestsView, FriendshipResult, FriendView, UserSummary } from '@music-room/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { useFriendsChanged } from '@/profile/MeRealtimeProvider';
import { PersonRow } from '@/profile/PersonRow';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { EmptyState, IconButton, Screen, ScreenHeader, SectionHeader, Text } from '@/ui';

// The Friends tab: search people at the top; below, requests waiting for
// you, your friends, requests you sent. Live: reloads when /me says
// something changed (accepted, declined, unfriended…).
export default function FriendsScreen() {
  const { authedApi } = useSession();
  const [requests, setRequests] = useState<FriendRequestsView | null>(null);
  const [friends, setFriends] = useState<FriendView[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([
        authedApi<FriendRequestsView>('/friends/requests'),
        authedApi<FriendView[]>('/friends'),
      ]);
      setRequests(r);
      setFriends(f);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your friends');
    }
  }, [authedApi]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useFriendsChanged(() => void load());

  // Search as you type (from 2 letters), a moment after the last key.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      authedApi<UserSummary[]>(`/users?q=${encodeURIComponent(q)}`).then(
        (r) => {
          if (!cancelled) setResults(r);
        },
        () => {
          if (!cancelled) setResults([]);
        },
      ).finally(() => {
        if (!cancelled) setSearching(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authedApi, q]);

  const act = async (userId: string, action: () => Promise<unknown>) => {
    setBusy(userId);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };
  const accept = (id: string) => act(id, () => authedApi<FriendshipResult>(`/friends/requests/${id}/accept`, { method: 'POST' }));
  const drop = (id: string) => act(id, () => authedApi(`/friends/requests/${id}`, { method: 'DELETE' }));

  const searchingMode = q.length >= 2;

  return (
    <Screen>
      <ScreenHeader title="Friends" />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find people by name"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Find people by name"
          style={styles.searchInput}
        />
        {searching ? <ActivityIndicator color={colors.accent} /> : null}
        {query ? <IconButton icon="close-circle" label="Clear the search" size={32} onPress={() => setQuery('')} /> : null}
      </View>
      {error ? <Text variant="error">{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
        {searchingMode ? (
          results?.length ? (
            results.map((u) => <PersonRow key={u.id} person={u} />)
          ) : results && !searching ? (
            <EmptyState icon="search-outline" title="Nobody found" text={`No one called “${q}”.`} />
          ) : null
        ) : (
          <>
            {requests?.incoming.length ? (
              <View>
                <SectionHeader title={`Requests · ${requests.incoming.length}`} />
                {requests.incoming.map((r) => (
                  <PersonRow
                    key={r.user.id}
                    person={r.user}
                    detail="Wants to be your friend"
                    trailing={
                      <View style={styles.actions}>
                        <IconButton icon="checkmark" label={`Accept ${r.user.displayName}`} variant="filled" size={36} disabled={busy !== null} onPress={() => void accept(r.user.id)} />
                        <IconButton icon="close" label={`Decline ${r.user.displayName}`} variant="tonal" size={36} disabled={busy !== null} onPress={() => void drop(r.user.id)} />
                      </View>
                    }
                  />
                ))}
              </View>
            ) : null}

            <View>
              <SectionHeader title={`My friends${friends?.length ? ` · ${friends.length}` : ''}`} />
              {friends?.length ? (
                friends.map((f) => (
                  <PersonRow key={f.user.id} person={f.user} detail={`Friends since ${new Date(f.since).toLocaleDateString()}`} />
                ))
              ) : friends ? (
                <EmptyState icon="people-outline" title="No friends yet" text="Search for people above and add them." />
              ) : null}
            </View>

            {requests?.sent.length ? (
              <View>
                <SectionHeader title="Waiting for an answer" />
                {requests.sent.map((r) => (
                  <PersonRow
                    key={r.user.id}
                    person={r.user}
                    detail="Request sent"
                    trailing={<IconButton icon="close" label={`Cancel the request to ${r.user.displayName}`} variant="tonal" size={36} disabled={busy !== null} onPress={() => void drop(r.user.id)} />}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.sm },
});

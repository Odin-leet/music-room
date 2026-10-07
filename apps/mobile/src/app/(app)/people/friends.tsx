import type { FriendRequestsView, FriendshipResult, FriendView } from '@music-room/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useFriendsChanged } from '@/profile/MeRealtimeProvider';
import { PersonRow } from '@/profile/PersonRow';
import { useSession } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Screen, Text } from '@/ui';

// Requests to answer, requests I sent, and my friends. Loads on open, on
// pull-to-refresh, and live: whenever /me says something changed.
export default function FriendsScreen() {
  const { authedApi } = useSession();
  const [requests, setRequests] = useState<FriendRequestsView | null>(null);
  const [friends, setFriends] = useState<FriendView[] | null>(null);
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

  return (
    <Screen>
      <Text variant="title">Friends</Text>
      {error ? <Text variant="error">{error}</Text> : null}
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
        {requests?.incoming.length ? (
          <View style={styles.section}>
            <Text variant="muted">Requests for you</Text>
            {requests.incoming.map((r) => (
              <View key={r.user.id} style={styles.section}>
                <PersonRow person={r.user} detail="Wants to be your friend" />
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Button
                      title="Accept"
                      loading={busy === r.user.id}
                      disabled={busy !== null}
                      onPress={() =>
                        void act(r.user.id, () =>
                          authedApi<FriendshipResult>(`/friends/requests/${r.user.id}/accept`, { method: 'POST' }),
                        )
                      }
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      title="Decline"
                      variant="secondary"
                      disabled={busy !== null}
                      onPress={() =>
                        void act(r.user.id, () => authedApi(`/friends/requests/${r.user.id}`, { method: 'DELETE' }))
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="muted">My friends{friends ? ` (${friends.length})` : ''}</Text>
          {friends?.length
            ? friends.map((f) => (
                <PersonRow
                  key={f.user.id}
                  person={f.user}
                  detail={`Friends since ${new Date(f.since).toLocaleDateString()}`}
                />
              ))
            : friends
              ? <Text variant="muted">No friends yet. Find people with the search.</Text>
              : null}
        </View>

        {requests?.sent.length ? (
          <View style={styles.section}>
            <Text variant="muted">Requests you sent</Text>
            {requests.sent.map((r) => (
              <View key={r.user.id} style={styles.row}>
                <View style={styles.flex}>
                  <PersonRow person={r.user} detail="Waiting for an answer" />
                </View>
                <Button
                  title="Cancel"
                  variant="secondary"
                  disabled={busy !== null}
                  onPress={() => void act(r.user.id, () => authedApi(`/friends/requests/${r.user.id}`, { method: 'DELETE' }))}
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <Button title="Find people" variant="secondary" onPress={() => router.push('/people')} />
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.lg },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});

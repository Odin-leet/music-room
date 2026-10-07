import type { FriendshipResult, UserProfile } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { GENRE_LABEL } from '@/profile/labels';
import { useSession } from '@/session/SessionProvider';
import { spacing } from '@/theme';
import { Button, Card, Screen, Text } from '@/ui';

// Someone's profile, as the API filtered it for you: only the tiers you may
// see are filled in (the app never decides that itself).
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await authedApi<UserProfile>(`/users/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this profile');
    }
  }, [authedApi, id]);

  // Back from elsewhere: they may have accepted / sent a request meanwhile.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Every friend action changes which tiers we may see: reload the profile.
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <Screen centered>
        <Text variant={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const name = profile.public.displayName;
  const request = () => authedApi<FriendshipResult>('/friends/requests', { method: 'POST', body: { userId: profile.id } });
  const accept = () => authedApi<FriendshipResult>(`/friends/requests/${profile.id}/accept`, { method: 'POST' });
  const dropRequest = () => authedApi(`/friends/requests/${profile.id}`, { method: 'DELETE' });
  const unfriend = () =>
    Alert.alert(`Unfriend ${name}?`, 'You will stop seeing each other’s friends-only info.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: () => void act(() => authedApi(`/friends/${profile.id}`, { method: 'DELETE' })),
      },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{name}</Text>
        {profile.public.bio ? <Text>{profile.public.bio}</Text> : <Text variant="muted">No bio.</Text>}

        {profile.relation === 'self' ? (
          <Button title="This is you — edit my profile" onPress={() => router.replace('/profile')} />
        ) : (
          <Card>
            {profile.friendship === 'none' ? (
              <Button title="Add friend" loading={busy} onPress={() => void act(request)} />
            ) : null}
            {profile.friendship === 'request_sent' ? (
              <>
                <Text variant="muted">Friend request sent. Waiting for {name}.</Text>
                <Button title="Cancel request" variant="secondary" loading={busy} onPress={() => void act(dropRequest)} />
              </>
            ) : null}
            {profile.friendship === 'request_received' ? (
              <>
                <Text>{name} wants to be your friend.</Text>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Button title="Accept" loading={busy} onPress={() => void act(accept)} />
                  </View>
                  <View style={styles.flex}>
                    <Button title="Decline" variant="secondary" disabled={busy} onPress={() => void act(dropRequest)} />
                  </View>
                </View>
              </>
            ) : null}
            {profile.friendship === 'friends' ? (
              <>
                <Text variant="success">You are friends.</Text>
                <Button title="Unfriend" variant="secondary" disabled={busy} onPress={unfriend} />
              </>
            ) : null}
          </Card>
        )}
        {error ? <Text variant="error">{error}</Text> : null}

        <Card>
          <Text variant="muted">Friends only</Text>
          {profile.friendsOnly ? (
            <>
              <Text>Real name: {profile.friendsOnly.realName ?? '—'}</Text>
              <Text>City: {profile.friendsOnly.city ?? '—'}</Text>
            </>
          ) : (
            <Text variant="muted">Only {name}’s friends can see this.</Text>
          )}
        </Card>

        <Card>
          <Text variant="muted">Music taste</Text>
          {profile.music ? (
            <>
              <Text>
                {profile.music.genres.length ? profile.music.genres.map((g) => GENRE_LABEL[g]).join(' · ') : 'No genres yet.'}
              </Text>
              {profile.music.artists.length ? (
                <Text variant="muted">Loves {profile.music.artists.join(', ')}</Text>
              ) : null}
            </>
          ) : (
            <Text variant="muted">{name} doesn’t share their music taste with you.</Text>
          )}
        </Card>

        {/* The private tier is never sent for anyone but yourself. */}
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});

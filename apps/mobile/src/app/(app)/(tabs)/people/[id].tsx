import type { FriendshipResult, UserProfile } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { GENRE_LABEL } from '@/profile/labels';
import { useFriendsChanged } from '@/profile/MeRealtimeProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, radius, spacing } from '@/theme';
import { Avatar, Button, type IconName, Screen, ScreenHeader, Text } from '@/ui';

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
  // Live: they accepted / declined / unfriended -> what we may see changed.
  useFriendsChanged((otherId) => {
    if (!otherId || otherId === id?.toLowerCase()) void load();
  });

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
        <ScreenHeader back title="" />
        <View style={styles.hero}>
          <Avatar name={name} size={96} />
          <Text variant="title" style={styles.center}>
            {name}
          </Text>
          <Text variant="muted" style={styles.center}>
            {profile.public.bio || 'No bio yet.'}
          </Text>

          {profile.relation === 'self' ? (
            <Button title="Edit my profile" icon="create-outline" size="sm" variant="secondary" onPress={() => router.replace('/profile')} />
          ) : profile.friendship === 'none' ? (
            <Button title="Add friend" icon="person-add" size="sm" loading={busy} onPress={() => void act(request)} />
          ) : profile.friendship === 'request_sent' ? (
            <>
              <Text variant="caption">Request sent. Waiting for {name}.</Text>
              <Button title="Cancel request" icon="close" size="sm" variant="secondary" loading={busy} onPress={() => void act(dropRequest)} />
            </>
          ) : profile.friendship === 'request_received' ? (
            <>
              <Text variant="caption">{name} wants to be your friend.</Text>
              <View style={styles.row}>
                <Button title="Accept" icon="checkmark" size="sm" loading={busy} onPress={() => void act(accept)} />
                <Button title="Decline" size="sm" variant="secondary" disabled={busy} onPress={() => void act(dropRequest)} />
              </View>
            </>
          ) : profile.friendship === 'friends' ? (
            <View style={styles.row}>
              <View style={styles.friends}>
                <Ionicons name="heart" size={16} color={colors.success} />
                <Text variant="success">Friends</Text>
              </View>
              <Button title="Unfriend" size="sm" variant="secondary" disabled={busy} onPress={unfriend} />
            </View>
          ) : null}
        </View>
        {error ? <Text variant="error">{error}</Text> : null}

        <Section icon="people-outline" title="Friends only">
          {profile.friendsOnly ? (
            <>
              <Detail label="Real name" value={profile.friendsOnly.realName} />
              <Detail label="City" value={profile.friendsOnly.city} />
            </>
          ) : (
            <Hidden text={`Only ${name}’s friends can see this.`} />
          )}
        </Section>

        <Section icon="musical-notes-outline" title="Music taste">
          {profile.music ? (
            <>
              {profile.music.genres.length ? (
                <View style={styles.chips}>
                  {profile.music.genres.map((g) => (
                    <View key={g} style={styles.chip}>
                      <Text variant="caption" style={styles.chipText}>
                        {GENRE_LABEL[g]}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text variant="muted">No genres yet.</Text>
              )}
              {profile.music.artists.length ? <Text variant="muted">Loves {profile.music.artists.join(', ')}</Text> : null}
            </>
          ) : (
            <Hidden text={`${name} doesn’t share their music taste with you.`} />
          )}
        </Section>
        {/* The private tier is never sent for anyone but yourself. */}
      </ScrollView>
    </Screen>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text variant="heading">{title}</Text>
      </View>
      {children}
    </View>
  );
}

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <View style={styles.detail}>
    <Text variant="muted">{label}</Text>
    <Text>{value ?? '—'}</Text>
  </View>
);

const Hidden = ({ text }: { text: string }) => (
  <View style={styles.hidden}>
    <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
    <Text variant="muted" style={styles.flex}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  friends: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between' },
  hidden: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  chipText: { color: colors.onPrimary },
});

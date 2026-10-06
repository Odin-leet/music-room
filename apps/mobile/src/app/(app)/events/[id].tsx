import type { EventView } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { DENY_MESSAGE, eventSubtitle, LICENSE_HINT } from '@/events/labels';
import { getCurrentCoords, LocationError, type Coords } from '@/events/location';
import { useSession } from '@/session/SessionProvider';
import { spacing } from '@/theme';
import { Button, Card, Screen, Text, TextField } from '@/ui';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [event, setEvent] = useState<EventView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Geo events: participation depends on where you are, so the location is
  // sent along once you've shared it.
  const [coords, setCoords] = useState<Coords | null>(null);

  const load = useCallback(
    async (at: Coords | null = coords) => {
      try {
        const query = at ? `?lat=${at.lat}&lng=${at.lng}` : '';
        setEvent(await authedApi<EventView>(`/events/${id}${query}`));
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load the event');
      }
    },
    [authedApi, id, coords],
  );

  // First load. Later reloads (join, location, invite) call load() explicitly.
  useEffect(() => {
    let cancelled = false;
    authedApi<EventView>(`/events/${id}`).then(
      (e) => {
        if (!cancelled) setEvent(e);
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load the event');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi, id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice(err instanceof LocationError || err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!event) {
    return (
      <Screen centered>
        <Text variant={loadError ? 'error' : 'muted'}>{loadError ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const isOwner = event.myRole === 'owner';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="title">{event.name}</Text>
        <Text variant="muted">
          {eventSubtitle(event)} · by {event.owner.displayName}
        </Text>
        {event.description ? <Text>{event.description}</Text> : null}

        <Card>
          <Text>{LICENSE_HINT[event.license]}</Text>
          {event.participation.allowed ? (
            <Text variant="success">You can vote and suggest tracks.</Text>
          ) : (
            <Text variant="error">{DENY_MESSAGE[event.participation.reason]}</Text>
          )}
          {event.license === 'geo' && event.geo ? (
            <>
              <Text variant="muted">
                Within {event.geo.radiusM} m · until {new Date(event.geo.endsAt).toLocaleTimeString()}
              </Text>
              <Button
                title={coords ? 'Check my location again' : 'Share my location'}
                variant="secondary"
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    const here = await getCurrentCoords();
                    setCoords(here);
                    await load(here);
                  })
                }
              />
            </>
          ) : null}
        </Card>

        {/* Not a member of a public event yet */}
        {!event.myRole ? (
          <Button
            title="Join this event"
            loading={busy}
            onPress={() =>
              void run(async () => {
                setEvent(await authedApi<EventView>(`/events/${event.id}/join`, { method: 'POST' }));
              })
            }
          />
        ) : null}

        {/* Members see the code: it's what lets others in */}
        {event.inviteCode ? (
          <Card>
            <Text variant="muted">Invite code</Text>
            <Text variant="title" selectable>
              {event.inviteCode}
            </Text>
            <Button
              title="Share code"
              variant="secondary"
              onPress={() =>
                void Share.share({
                  message: `Join "${event.name}" on Music Room with the code ${event.inviteCode}`,
                })
              }
            />
          </Card>
        ) : null}

        {isOwner ? <InviteByEmail eventId={event.id} onInvited={() => void load()} /> : null}

        {notice ? <Text variant="error">{notice}</Text> : null}

        {isOwner ? (
          <Button
            title="Delete event"
            variant="secondary"
            onPress={() =>
              Alert.alert('Delete event?', `"${event.name}" and its queue will be removed for everyone.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await authedApi(`/events/${event.id}`, { method: 'DELETE' });
                      router.back();
                    }),
                },
              ])
            }
          />
        ) : null}
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

// Owner only: invite a registered account (they can then vote under "Invited only").
function InviteByEmail({ eventId, onInvited }: { eventId: string; onInvited: () => void }) {
  const { authedApi } = useSession();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [done, setDone] = useState<string | null>(null);

  const invite = async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    setErrors(noErrors);
    setDone(null);
    try {
      const res = await authedApi<{ invited: { displayName: string } }>(`/events/${eventId}/invites`, {
        method: 'POST',
        body: { email: email.trim() },
      });
      setDone(`${res.invited.displayName} is invited.`);
      setEmail('');
      onInvited();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <TextField
        label="Invite by email"
        placeholder="friend@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.fields.email ?? errors.form ?? undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => void invite()}
      />
      {done ? <Text variant="success">{done}</Text> : null}
      <Button title="Invite" variant="secondary" loading={sending} disabled={!email.trim()} onPress={() => void invite()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
});

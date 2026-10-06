import type { PlaylistLicense, PlaylistView, PlaylistVisibility } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { EDIT_DENY_MESSAGE, PLAYLIST_LICENSE_HINT, playlistSubtitle } from '@/playlists/labels';
import { PlaylistSettingsChips } from '@/playlists/PlaylistSettingsChips';
import { useSession } from '@/session/SessionProvider';
import { spacing } from '@/theme';
import { Button, Card, Screen, Text, TextField } from '@/ui';

// Playlist details: who can edit, invite code, invites, settings, delete.
// The tracks themselves are the playlist's main screen (./index.tsx).
export default function PlaylistInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlaylist(await authedApi<PlaylistView>(`/playlists/${id}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load the playlist');
    }
  }, [authedApi, id]);

  // First load. Later reloads (join, invite, settings) call load() or set the result.
  useEffect(() => {
    let cancelled = false;
    authedApi<PlaylistView>(`/playlists/${id}`).then(
      (p) => {
        if (!cancelled) setPlaylist(p);
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load the playlist');
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
      setNotice(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!playlist) {
    return (
      <Screen centered>
        <Text variant={loadError ? 'error' : 'muted'}>{loadError ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const isOwner = playlist.myRole === 'owner';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="title">{playlist.name}</Text>
        <Text variant="muted">
          {playlistSubtitle(playlist)} · by {playlist.owner.displayName}
        </Text>
        {playlist.description ? <Text>{playlist.description}</Text> : null}

        <Card>
          <Text>{PLAYLIST_LICENSE_HINT[playlist.license]}</Text>
          {playlist.canEdit.allowed ? (
            <Text variant="success">You can add, remove and reorder tracks.</Text>
          ) : (
            <Text variant="error">{EDIT_DENY_MESSAGE[playlist.canEdit.reason]}</Text>
          )}
        </Card>

        {/* Not a member of a public playlist yet */}
        {!playlist.myRole ? (
          <Button
            title="Join this playlist"
            loading={busy}
            onPress={() =>
              void run(async () => {
                setPlaylist(await authedApi<PlaylistView>(`/playlists/${playlist.id}/join`, { method: 'POST' }));
              })
            }
          />
        ) : null}

        {/* Members see the code: it's what lets others in */}
        {playlist.inviteCode ? (
          <Card>
            <Text variant="muted">Invite code</Text>
            <Text variant="title" selectable>
              {playlist.inviteCode}
            </Text>
            <Button
              title="Share code"
              variant="secondary"
              onPress={() =>
                void Share.share({
                  message: `Join the playlist "${playlist.name}" on Music Room with the code ${playlist.inviteCode}`,
                })
              }
            />
          </Card>
        ) : null}

        {isOwner ? <InviteByEmail playlistId={playlist.id} onInvited={() => void load()} /> : null}
        {isOwner ? <OwnerSettings playlist={playlist} onSaved={setPlaylist} /> : null}

        {notice ? <Text variant="error">{notice}</Text> : null}

        {isOwner ? (
          <Button
            title="Delete playlist"
            variant="secondary"
            onPress={() =>
              Alert.alert('Delete playlist?', `"${playlist.name}" and its tracks will be removed for everyone.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await authedApi(`/playlists/${playlist.id}`, { method: 'DELETE' });
                      // Not back(): that would land on this (now deleted) playlist's tracks.
                      router.dismissTo('/playlists');
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

// Owner only: invite a registered account (they can then edit under "Invited only").
function InviteByEmail({ playlistId, onInvited }: { playlistId: string; onInvited: () => void }) {
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
      const res = await authedApi<{ invited: { displayName: string } }>(`/playlists/${playlistId}/invites`, {
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

// Owner only: name, description, who can find it, who can edit.
function OwnerSettings({ playlist, onSaved }: { playlist: PlaylistView; onSaved: (p: PlaylistView) => void }) {
  const { authedApi } = useSession();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description);
  const [visibility, setVisibility] = useState<PlaylistVisibility>(playlist.visibility);
  const [license, setLicense] = useState<PlaylistLicense>(playlist.license);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [saved, setSaved] = useState(false);

  const changed =
    name.trim() !== playlist.name ||
    description.trim() !== playlist.description ||
    visibility !== playlist.visibility ||
    license !== playlist.license;

  const save = async () => {
    if (!name.trim() || !changed || saving) return;
    setSaving(true);
    setErrors(noErrors);
    setSaved(false);
    try {
      const updated = await authedApi<PlaylistView>(`/playlists/${playlist.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), description: description.trim(), visibility, license },
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Text variant="muted">Settings</Text>
      <TextField label="Name" value={name} onChangeText={setName} error={errors.fields.name} maxLength={100} />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        error={errors.fields.description}
        maxLength={500}
      />
      <PlaylistSettingsChips
        visibility={visibility}
        license={license}
        onVisibility={setVisibility}
        onLicense={setLicense}
      />
      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      {saved && !changed ? <Text variant="success">Saved.</Text> : null}
      <Button
        title="Save settings"
        variant="secondary"
        loading={saving}
        disabled={!name.trim() || !changed}
        onPress={() => void save()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
});

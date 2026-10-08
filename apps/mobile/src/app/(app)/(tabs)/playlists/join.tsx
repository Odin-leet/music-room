import type { PlaylistView } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';

export default function JoinPlaylistScreen() {
  const { authedApi } = useSession();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  // Codes are 8 characters; the API ignores case and spaces.
  const clean = code.replace(/\s+/g, '').toUpperCase();
  const canJoin = clean.length === 8 && !joining;

  const join = async () => {
    if (!canJoin) return;
    setJoining(true);
    setErrors(noErrors);
    try {
      const playlist = await authedApi<PlaylistView>('/playlists/join', {
        method: 'POST',
        body: { inviteCode: clean },
      });
      router.replace({ pathname: '/playlists/[id]', params: { id: playlist.id } });
    } catch (err) {
      setErrors(toFormErrors(err));
      setJoining(false);
    }
  };

  return (
    <Screen centered form>
      <Text variant="title">Join a playlist</Text>
      <Text variant="muted">Enter the 8-character code the owner shared with you.</Text>
      <TextField
        label="Invite code"
        placeholder="ABCD2345"
        value={code}
        onChangeText={setCode}
        error={errors.fields.inviteCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        returnKeyType="go"
        onSubmitEditing={() => void join()}
      />
      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      <Button title="Join" loading={joining} disabled={!canJoin} onPress={() => void join()} />
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

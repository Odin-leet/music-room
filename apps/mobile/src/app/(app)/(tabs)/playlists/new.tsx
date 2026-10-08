import type { PlaylistLicense, PlaylistView, PlaylistVisibility } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { PlaylistSettingsChips } from '@/playlists/PlaylistSettingsChips';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField, ScreenHeader } from '@/ui';

export default function NewPlaylistScreen() {
  const { authedApi } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlaylistVisibility>('public');
  const [license, setLicense] = useState<PlaylistLicense>('open');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      const playlist = await authedApi<PlaylistView>('/playlists', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim(), visibility, license },
      });
      router.replace({ pathname: '/playlists/[id]', params: { id: playlist.id } });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen form>
      <ScreenHeader back title="New playlist" />
      <TextField
        label="Name"
        placeholder="Road trip"
        value={name}
        onChangeText={setName}
        error={errors.fields.name}
        maxLength={100}
      />
      <TextField
        label="Description (optional)"
        placeholder="Songs for the long drive"
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
      <Button title="Create playlist" loading={submitting} disabled={!name.trim()} onPress={() => void submit()} />
    </Screen>
  );
}

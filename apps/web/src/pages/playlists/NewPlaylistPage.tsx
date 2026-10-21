import type { PlaylistLicense, PlaylistView, PlaylistVisibility } from '@music-room/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { PlaylistSettingsChips } from '@/playlists/PlaylistSettingsChips';
import { useSession } from '@/session/SessionProvider';
import { Button, Page, PageHeader, TextField } from '@/ui';

export function NewPlaylistPage() {
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlaylistVisibility>('public');
  const [license, setLicense] = useState<PlaylistLicense>('open');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      const playlist = await authedApi<PlaylistView>('/playlists', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim(), visibility, license },
      });
      navigate(`/playlists/${playlist.id}`, { replace: true });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader back="/playlists" title="New playlist" />
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <TextField label="Name" placeholder="Road trip" value={name} onChangeText={setName} error={errors.fields.name} maxLength={100} autoFocus />
        <TextField label="Description (optional)" placeholder="Songs for the long drive" value={description} onChangeText={setDescription} error={errors.fields.description} maxLength={500} />
        <PlaylistSettingsChips visibility={visibility} license={license} onVisibility={setVisibility} onLicense={setLicense} />
        {errors.form ? <p className="error">{errors.form}</p> : null}
        <Button type="submit" title="Create playlist" loading={submitting} disabled={!name.trim()} block />
      </form>
    </Page>
  );
}

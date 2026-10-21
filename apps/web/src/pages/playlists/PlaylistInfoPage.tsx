import type { PlaylistLicense, PlaylistView, PlaylistVisibility } from '@music-room/shared';
import { useCallback, useEffect, useState } from 'react';
import { IoSettingsOutline, IoTrashOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { EDIT_DENY_MESSAGE, PLAYLIST_LICENSE_HINT, playlistSubtitle } from '@/playlists/labels';
import { PlaylistSettingsChips } from '@/playlists/PlaylistSettingsChips';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, CardTitle, Page, PageHeader, PageStatus, TextField, useDialogs } from '@/ui';
import { InviteByEmail, InviteCodeCard } from '@/pages/shared/InviteCards';

// Playlist details: who can edit, invite code, invites, settings, delete.
export function PlaylistInfoPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const { confirm } = useDialogs();
  const navigate = useNavigate();
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

  useEffect(() => {
    let cancelled = false;
    authedApi<PlaylistView>(`/playlists/${id}`).then(
      (p) => !cancelled && setPlaylist(p),
      (err: unknown) => !cancelled && setLoadError(err instanceof ApiError ? err.message : 'Could not load the playlist'),
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

  if (!playlist) return <PageStatus error={loadError} back={`/playlists/${id}`} />;
  const isOwner = playlist.myRole === 'owner';

  const remove = async () => {
    const ok = await confirm({ title: 'Delete playlist?', message: `“${playlist.name}” and its tracks will be removed for everyone.`, confirm: 'Delete', destructive: true });
    if (!ok) return;
    void run(async () => {
      await authedApi(`/playlists/${playlist.id}`, { method: 'DELETE' });
      navigate('/playlists', { replace: true });
    });
  };

  return (
    <Page narrow>
      <PageHeader back={`/playlists/${playlist.id}`} title={playlist.name} subtitle={`${playlistSubtitle(playlist)} · by ${playlist.owner.displayName}`} />
      {playlist.description ? <p>{playlist.description}</p> : null}

      <Card>
        <p>{PLAYLIST_LICENSE_HINT[playlist.license]}</p>
        {playlist.canEdit.allowed ? (
          <p className="success">You can add, remove and reorder tracks.</p>
        ) : (
          <p className="error">{EDIT_DENY_MESSAGE[playlist.canEdit.reason]}</p>
        )}
      </Card>

      {!playlist.myRole ? (
        <Button
          title="Join this playlist"
          loading={busy}
          onClick={() => void run(async () => setPlaylist(await authedApi<PlaylistView>(`/playlists/${playlist.id}/join`, { method: 'POST' })))}
        />
      ) : null}

      {playlist.inviteCode ? (
        <InviteCodeCard code={playlist.inviteCode} message={`Join the playlist “${playlist.name}” on HOLY with the code ${playlist.inviteCode}`} />
      ) : null}
      {isOwner ? <InviteByEmail path={`/playlists/${playlist.id}/invites`} onInvited={() => void load()} /> : null}
      {isOwner ? <OwnerSettings playlist={playlist} onSaved={setPlaylist} /> : null}

      {notice ? <p className="error">{notice}</p> : null}
      {isOwner ? <Button title="Delete playlist" icon={IoTrashOutline} variant="danger" onClick={() => void remove()} /> : null}
    </Page>
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

  const changed = name.trim() !== playlist.name || description.trim() !== playlist.description || visibility !== playlist.visibility || license !== playlist.license;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !changed || saving) return;
    setSaving(true);
    setErrors(noErrors);
    setSaved(false);
    try {
      onSaved(
        await authedApi<PlaylistView>(`/playlists/${playlist.id}`, {
          method: 'PATCH',
          body: { name: name.trim(), description: description.trim(), visibility, license },
        }),
      );
      setSaved(true);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card roomy>
      <CardTitle icon={IoSettingsOutline} title="Settings" />
      <form className="stack" onSubmit={(e) => void save(e)} noValidate>
        <TextField label="Name" value={name} onChangeText={setName} error={errors.fields.name} maxLength={100} />
        <TextField label="Description" value={description} onChangeText={setDescription} error={errors.fields.description} maxLength={500} />
        <PlaylistSettingsChips visibility={visibility} license={license} onVisibility={setVisibility} onLicense={setLicense} />
        {errors.form ? <p className="error">{errors.form}</p> : null}
        {saved && !changed ? <p className="success">Saved.</p> : null}
        <Button type="submit" title="Save settings" variant="secondary" loading={saving} disabled={!name.trim() || !changed} />
      </form>
    </Card>
  );
}

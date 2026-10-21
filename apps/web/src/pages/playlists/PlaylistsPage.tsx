import type { PlaylistView } from '@music-room/shared';
import { useCallback, useState } from 'react';
import { IoAdd, IoChevronForward, IoKeyOutline, IoMusicalNotes, IoMusicalNotesOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { useLoadOnShow } from '@/lib/useLoad';
import { playlistSubtitle } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { Cover, EmptyState, IconButton, ListItem, Page, PageHeader, Spinner } from '@/ui';

// Public playlists + the ones I belong to, most recently edited first.
export function PlaylistsPage() {
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    authedApi<PlaylistView[]>('/playlists').then(
      (p) => {
        setPlaylists(p);
        setError(null);
      },
      (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load playlists'),
    );
  }, [authedApi]);
  useLoadOnShow(load);

  return (
    <Page>
      <PageHeader
        title="Playlists"
        right={
          <>
            <IconButton icon={IoKeyOutline} label="Join with a code" variant="tonal" onClick={() => navigate('/playlists/join')} />
            <IconButton icon={IoAdd} label="Create a playlist" variant="filled" onClick={() => navigate('/playlists/new')} />
          </>
        }
      />
      {error ? <p className="error">{error}</p> : null}
      {!playlists && !error ? <Spinner large /> : null}
      {playlists && !playlists.length ? (
        <EmptyState icon={IoMusicalNotesOutline} title="No playlists yet" text="Create one, or join a friend's with its code." action="Create a playlist" onAction={() => navigate('/playlists/new')} />
      ) : null}
      <ul className="list">
        {(playlists ?? []).map((p) => (
          <li key={p.id}>
            <ListItem
              to={`/playlists/${p.id}`}
              title={`${p.visibility === 'private' ? '🔒 ' : ''}${p.name}`}
              subtitle={`${playlistSubtitle(p)} · by ${p.owner.displayName}`}
              leading={<Cover uris={p.covers} uri={p.covers[0]} size={56} icon={IoMusicalNotes} />}
              trailing={<IoChevronForward className="chevron" size={18} aria-hidden />}
            />
          </li>
        ))}
      </ul>
    </Page>
  );
}

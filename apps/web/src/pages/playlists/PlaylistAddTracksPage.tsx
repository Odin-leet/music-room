import type { PlaylistTrackView, TrackSummary } from '@music-room/shared';
import { useState } from 'react';
import { IoAddCircle, IoCheckmarkCircle, IoCheckmarkDoneCircleOutline, IoSearchOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { duration, useTrackSearch } from '@/lib/useTrackSearch';
import { useSession } from '@/session/SessionProvider';
import { Button, Cover, EmptyState, ListItem, Page, PageHeader, SearchBox, Spinner } from '@/ui';

type RowState = 'adding' | 'added' | 'already';

// Search and add tracks to the end of the playlist. Stays open, so several
// tracks can be added in a row.
export function PlaylistAddTracksPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { results, searching, error: searchError } = useTrackSearch(query);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  const mark = (trackId: string, state: RowState | null) =>
    setRows((r) => {
      const next = { ...r };
      if (state) next[trackId] = state;
      else delete next[trackId];
      return next;
    });

  const add = async (track: TrackSummary) => {
    if (rows[track.providerTrackId]) return;
    mark(track.providerTrackId, 'adding');
    setError(null);
    try {
      await authedApi<PlaylistTrackView>(`/playlists/${id}/tracks`, { method: 'POST', body: { providerTrackId: track.providerTrackId } });
      mark(track.providerTrackId, 'added');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        mark(track.providerTrackId, 'already');
      } else {
        mark(track.providerTrackId, null);
        setError(err instanceof ApiError ? err.message : 'Could not add this track');
      }
    }
  };

  const added = Object.values(rows).filter((s) => s === 'added').length;
  const label: Record<RowState, string> = { adding: 'Adding…', added: 'Added', already: 'Already in' };

  return (
    <Page narrow>
      <PageHeader
        back={`/playlists/${id}`}
        title="Add tracks"
        right={<Button title={added ? `Done (${added} added)` : 'Done'} size="sm" variant="secondary" onClick={() => navigate(`/playlists/${id}`)} />}
      />
      <SearchBox value={query} onChange={setQuery} placeholder="Artist or song" busy={searching} autoFocus />
      {error || searchError ? <p className="error">{error ?? searchError}</p> : null}
      {results && !results.length && !searching ? <EmptyState icon={IoSearchOutline} title="Nothing found" text={`No track matches “${query.trim()}”.`} /> : null}
      <ul className="list">
        {(results ?? []).map((t) => {
          const state = rows[t.providerTrackId];
          return (
            <li key={t.providerTrackId}>
              <ListItem
                title={t.title}
                subtitle={state === 'already' ? `${t.artist} · already in the playlist` : `${t.artist} · ${duration(t.durationSec)}`}
                leading={<Cover uri={t.coverUrl} size={48} />}
                trailing={
                  state === 'adding' ? (
                    <Spinner />
                  ) : state === 'added' ? (
                    <IoCheckmarkCircle size={28} color="var(--success)" aria-hidden />
                  ) : state === 'already' ? (
                    <IoCheckmarkDoneCircleOutline size={28} color="var(--text-muted)" aria-hidden />
                  ) : (
                    <IoAddCircle size={28} color="var(--accent)" aria-hidden />
                  )
                }
                onClick={() => void add(t)}
                disabled={!!state}
                label={`${state ? label[state] : 'Add'}: ${t.title} by ${t.artist}`}
              />
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

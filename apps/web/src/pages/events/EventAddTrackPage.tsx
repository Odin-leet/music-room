import type { TrackSummary } from '@music-room/shared';
import { useState } from 'react';
import { IoAddCircle, IoSearchOutline } from 'react-icons/io5';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '@/api/client';
import { getCurrentCoords, LocationError } from '@/events/location';
import { duration, useTrackSearch } from '@/lib/useTrackSearch';
import { useSession } from '@/session/SessionProvider';
import { Cover, EmptyState, ListItem, Page, PageHeader, SearchBox, Spinner } from '@/ui';

// Search a track and suggest it to the event's queue.
export function EventAddTrackPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const geo = params.get('geo') === '1';
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { results, searching, error: searchError } = useTrackSearch(query);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (track: TrackSummary) => {
    if (adding) return;
    setAdding(track.providerTrackId);
    setError(null);
    try {
      // Geo events check where you are for suggestions too.
      const at = geo ? await getCurrentCoords() : null;
      await authedApi(`/events/${id}/tracks`, { method: 'POST', body: { providerTrackId: track.providerTrackId, ...(at ?? {}) } });
      navigate(`/events/${id}`, { replace: true }); // the queue reloads (and everyone else gets it live)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof LocationError ? err.message : 'Could not add this track');
      setAdding(null);
    }
  };

  return (
    <Page narrow>
      <PageHeader back={`/events/${id}`} title="Add a track" />
      <SearchBox value={query} onChange={setQuery} placeholder="Artist or song" busy={searching} autoFocus />
      {error || searchError ? <p className="error">{error ?? searchError}</p> : null}
      {results && !results.length && !searching ? <EmptyState icon={IoSearchOutline} title="Nothing found" text={`No track matches “${query.trim()}”.`} /> : null}
      <ul className="list">
        {(results ?? []).map((t) => (
          <li key={t.providerTrackId}>
            <ListItem
              title={t.title}
              subtitle={`${t.artist} · ${duration(t.durationSec)}`}
              leading={<Cover uri={t.coverUrl} size={48} />}
              trailing={adding === t.providerTrackId ? <Spinner /> : <IoAddCircle size={28} color="var(--accent)" aria-hidden />}
              onClick={() => void add(t)}
              disabled={adding !== null}
              label={`Suggest ${t.title} by ${t.artist}`}
            />
          </li>
        ))}
      </ul>
    </Page>
  );
}

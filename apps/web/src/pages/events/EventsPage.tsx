import type { EventView } from '@music-room/shared';
import { useCallback, useState } from 'react';
import { IoAdd, IoChevronForward, IoKeyOutline, IoPeople, IoPeopleOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { eventSubtitle } from '@/events/labels';
import { useLoadOnShow } from '@/lib/useLoad';
import { useSession } from '@/session/SessionProvider';
import { Cover, EmptyState, IconButton, ListItem, Page, PageHeader, Spinner } from '@/ui';

// Public events + the ones I belong to.
export function EventsPage() {
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    authedApi<EventView[]>('/events').then(
      (e) => {
        setEvents(e);
        setError(null);
      },
      (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load events'),
    );
  }, [authedApi]);
  useLoadOnShow(load);

  return (
    <Page>
      <PageHeader
        title="Events"
        right={
          <>
            <IconButton icon={IoKeyOutline} label="Join with a code" variant="tonal" onClick={() => navigate('/events/join')} />
            <IconButton icon={IoAdd} label="Create an event" variant="filled" onClick={() => navigate('/events/new')} />
          </>
        }
      />
      {error ? <p className="error">{error}</p> : null}
      {!events && !error ? <Spinner large /> : null}
      {events && !events.length ? (
        <EmptyState icon={IoPeopleOutline} title="No events yet" text="Create one, or join a friend's with its code." action="Create an event" onAction={() => navigate('/events/new')} />
      ) : null}
      <ul className="list">
        {(events ?? []).map((e) => (
          <li key={e.id}>
            <ListItem
              to={`/events/${e.id}`}
              title={`${e.visibility === 'private' ? '🔒 ' : ''}${e.name}`}
              subtitle={`${eventSubtitle(e)} · by ${e.owner.displayName}`}
              leading={<Cover uri={e.cover} size={56} icon={IoPeople} />}
              trailing={<IoChevronForward className="chevron" size={18} aria-hidden />}
            />
          </li>
        ))}
      </ul>
    </Page>
  );
}

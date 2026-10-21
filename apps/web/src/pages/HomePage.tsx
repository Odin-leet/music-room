import type { EventView, PlaylistView } from '@music-room/shared';
import { useCallback, useState, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { IoAdd, IoChevronForward, IoMusicalNotes, IoPeople, IoPersonAdd } from 'react-icons/io5';
import { Link, useNavigate } from 'react-router';
import { eventSubtitle } from '@/events/labels';
import { useLoadOnShow } from '@/lib/useLoad';
import { playlistSubtitle } from '@/playlists/labels';
import { useIncomingRequests } from '@/realtime/MeRealtimeProvider';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { Avatar, Cover, Page, PageHeader, SectionHeader } from '@/ui';

const SHOW = 8; // cards per row; "See all" opens the section

// What's going on: friend requests waiting, events to join, playlists.
export function HomePage() {
  const { authedApi } = useSession();
  const { me } = useCurrentUser();
  const incoming = useIncomingRequests();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistView[] | null>(null);

  const load = useCallback(() => {
    void Promise.all([
      authedApi<EventView[]>('/events').catch(() => null),
      authedApi<PlaylistView[]>('/playlists').catch(() => null),
    ]).then(([e, p]) => {
      setEvents(e);
      // Mine first (owned or joined), then public ones.
      setPlaylists(p ? [...p].sort((a, b) => Number(!!b.myRole) - Number(!!a.myRole)) : null);
    });
  }, [authedApi]);
  useLoadOnShow(load);

  const name = me.state === 'ok' ? me.user.displayName : '';

  return (
    <Page>
      <PageHeader
        title={name ? `Hi, ${name.split(' ')[0]}` : 'HOLY'}
        subtitle="What are we listening to?"
        right={
          <Link to="/profile" aria-label="My profile">
            <Avatar name={name || '?'} size={40} />
          </Link>
        }
      />

      {incoming ? (
        <Link to="/people" className="banner">
          <IoPersonAdd size={20} aria-hidden />
          <span className="grow">
            {incoming} friend request{incoming > 1 ? 's' : ''} waiting
          </span>
          <IoChevronForward size={18} aria-hidden />
        </Link>
      ) : null}

      <section>
        <SectionHeader title="Events" action="See all" onAction={() => navigate('/events')} />
        <Row>
          {(events ?? []).slice(0, SHOW).map((e) => (
            <HomeCard key={e.id} to={`/events/${e.id}`} title={e.name} subtitle={eventSubtitle(e)} cover={<Cover uri={e.cover} size={168} icon={IoPeople} />} />
          ))}
          <NewCard icon={IoAdd} label="New event" to="/events/new" />
        </Row>
      </section>

      <section>
        <SectionHeader title="Playlists" action="See all" onAction={() => navigate('/playlists')} />
        <Row>
          {(playlists ?? []).slice(0, SHOW).map((p) => (
            <HomeCard
              key={p.id}
              to={`/playlists/${p.id}`}
              title={p.name}
              subtitle={playlistSubtitle(p)}
              cover={<Cover uris={p.covers} uri={p.covers[0]} size={168} icon={IoMusicalNotes} />}
            />
          ))}
          <NewCard icon={IoAdd} label="New playlist" to="/playlists/new" />
        </Row>
      </section>
    </Page>
  );
}

// A horizontal row of cards on phones, a grid on wide screens.
const Row = ({ children }: { children: ReactNode }) => <div className="card-row" style={{ marginTop: 'var(--md)' }}>{children}</div>;

function HomeCard({ to, title, subtitle, cover }: { to: string; title: string; subtitle: string; cover: ReactNode }) {
  return (
    <Link to={to} className="home-card" aria-label={`${title}, ${subtitle}`}>
      {cover}
      <span className="home-card-title ellipsis">{title}</span>
      <span className="caption clamp-2">{subtitle}</span>
    </Link>
  );
}

function NewCard({ icon: Icon, label, to }: { icon: IconType; label: string; to: string }) {
  return (
    <Link to={to} className="home-card">
      <span className="new-cover">
        <Icon size={40} aria-hidden />
      </span>
      <span className="home-card-title">{label}</span>
    </Link>
  );
}

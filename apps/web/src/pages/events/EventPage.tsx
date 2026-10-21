import { compareQueueTracks, type BroadcastTrack, type EventView, type QueueTrack, type QueueView, type VoteResult } from '@music-room/shared';
import { useCallback, useRef, useState } from 'react';
import { IoAdd, IoArrowUpCircle, IoArrowUpCircleOutline, IoInformationCircleOutline, IoLocationOutline, IoLockClosedOutline, IoMusicalNotesOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { DENY_MESSAGE, eventSubtitle } from '@/events/labels';
import { getCurrentCoords, LocationError, type Coords } from '@/events/location';
import { NowPlayingCard } from '@/events/NowPlayingCard';
import { useLoadOnShow } from '@/lib/useLoad';
import { usePlayer } from '@/player/PlayerProvider';
import { useEventRealtime } from '@/realtime/useEventRealtime';
import { useSession } from '@/session/SessionProvider';
import { Button, Cover, EmptyState, IconButton, ListItem, LiveDot, Notice, Page, PageHeader, PageStatus, SectionHeader, useDialogs } from '@/ui';

// The server's ranking rule (shared), applied locally right after an
// optimistic vote so the list reorders instantly; the next broadcast confirms it.
const byRank = (a: QueueTrack, b: QueueTrack) => compareQueueTracks(a, b);

// A Track Vote event: what's playing, and the ranked queue to vote on.
export function EventPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const { alert } = useDialogs();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventView | null>(null);
  const [upcoming, setUpcoming] = useState<QueueTrack[]>([]);
  const [nowPlaying, setNowPlaying] = useState<BroadcastTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Broadcasts are the same for everyone, so "did I vote for it" is kept here:
  // from GET /queue, then from my own vote / unvote responses.
  const myVotes = useRef(new Set<string>());
  // Geo events: where I am, sent with every vote once shared.
  const coords = useRef<Coords | null>(null);
  const eventRef = useRef<EventView | null>(null);

  // Takes either the REST queue or a broadcast; votedByMe always comes from myVotes.
  const { onEventQueue } = usePlayer();
  const applyQueue = useCallback(
    (q: { nowPlaying: BroadcastTrack | null; upcoming: BroadcastTrack[] }) => {
      setNowPlaying(q.nowPlaying);
      setUpcoming(q.upcoming.map((t) => ({ ...t, votedByMe: myVotes.current.has(t.id) })));
      onEventQueue(id, q); // if this browser plays the party, follow its "now playing"
    },
    [id, onEventQueue],
  );

  const load = useCallback(async () => {
    try {
      const at = coords.current;
      const [e, q] = await Promise.all([
        authedApi<EventView>(`/events/${id}${at ? `?lat=${at.lat}&lng=${at.lng}` : ''}`),
        authedApi<QueueView>(`/events/${id}/queue`),
      ]);
      myVotes.current = new Set(q.upcoming.filter((t) => t.votedByMe).map((t) => t.id));
      eventRef.current = e;
      setEvent(e);
      applyQueue(q);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the event');
    }
  }, [authedApi, id, applyQueue]);

  useLoadOnShow(useCallback(() => void load(), [load]));

  const live = useEventRealtime(id, {
    onQueue: applyQueue,
    onEventUpdated: () => void load(),
    onJoined: () => void load(),
    onGone: (why) => {
      void alert(
        why === 'deleted' ? 'Event deleted' : 'Event unavailable',
        why === 'deleted' ? 'The organiser deleted this event.' : 'You no longer have access to this event.',
      );
      navigate('/events', { replace: true });
    },
  });

  const shareLocation = async () => {
    setLocating(true);
    try {
      coords.current = await getCurrentCoords();
      await load();
    } catch (err) {
      setError(err instanceof LocationError ? err.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const toggleVote = async (track: QueueTrack) => {
    const voting = !track.votedByMe;
    // Optimistic: flip it now, reorder, then take the server's numbers.
    const flip = (t: QueueTrack, on: boolean, delta: number) => ({ ...t, votedByMe: on, score: t.score + delta });
    if (voting) myVotes.current.add(track.id);
    else myVotes.current.delete(track.id);
    setUpcoming((list) => list.map((t) => (t.id === track.id ? flip(t, voting, voting ? 1 : -1) : t)).sort(byRank));
    setError(null);

    const at = eventRef.current?.license === 'geo' ? coords.current : null;
    const path = `/events/${id}/tracks/${track.id}/vote`;
    try {
      const res = voting
        ? await authedApi<VoteResult>(path, { method: 'POST', body: at ?? {} })
        : await authedApi<VoteResult>(at ? `${path}?lat=${at.lat}&lng=${at.lng}` : path, { method: 'DELETE' });
      setUpcoming((list) => list.map((t) => (t.id === res.trackId ? { ...t, score: res.score } : t)).sort(byRank));
    } catch (err) {
      // Undo the optimistic change.
      if (voting) myVotes.current.delete(track.id);
      else myVotes.current.add(track.id);
      setUpcoming((list) => list.map((t) => (t.id === track.id ? flip(t, !voting, voting ? -1 : 1) : t)).sort(byRank));
      setError(err instanceof ApiError ? err.message : 'Your vote did not go through');
    }
  };

  if (!event) return <PageStatus error={error} back="/events" />;

  const canVote = event.participation.allowed;
  const needsLocation =
    !event.participation.allowed && (event.participation.reason === 'location_required' || event.participation.reason === 'outside_area');
  const addTrack = () => navigate(`/events/${event.id}/add${event.license === 'geo' ? '?geo=1' : ''}`);

  return (
    <Page>
      <PageHeader
        back="/events"
        title={event.name}
        subtitle={eventSubtitle(event)}
        right={
          <>
            <LiveDot status={live} />
            <IconButton icon={IoInformationCircleOutline} label="Event info and invite" onClick={() => navigate(`/events/${event.id}/info`)} />
          </>
        }
      />

      <div className="split">
        <div className="split-side stack">
          {canVote ? null : <Notice icon={IoLockClosedOutline}>{DENY_MESSAGE[event.participation.reason]}</Notice>}
          {needsLocation ? (
            <Button title="Share my location" icon={IoLocationOutline} variant="secondary" loading={locating} onClick={() => void shareLocation()} />
          ) : null}
          <NowPlayingCard event={event} nowPlaying={nowPlaying} queueLength={upcoming.length} isOwner={event.myRole === 'owner'} />
          {error ? <p className="error">{error}</p> : null}
        </div>

        <section className="stack-sm">
          <SectionHeader title={`Up next${upcoming.length ? ` · ${upcoming.length}` : ''}`} action={canVote ? '+ Add' : undefined} onAction={addTrack} />
          {upcoming.length ? (
            <ol className="list">
              {upcoming.map((t, index) => (
                <li key={t.id}>
                  <ListItem
                    title={t.title}
                    subtitle={`${t.artist}${t.suggestedBy ? ` · ${t.suggestedBy.displayName}` : ''}`}
                    leading={
                      <div className="row-sm">
                        <span className="caption queue-pos">{index + 1}</span>
                        <Cover uri={t.coverUrl} size={48} />
                      </div>
                    }
                    trailing={<VoteButton track={t} canVote={canVote} onClick={() => void toggleVote(t)} />}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={IoMusicalNotesOutline}
              title="The queue is empty"
              text={canVote ? 'Suggest the first track, then vote for what plays next.' : 'Tracks will show up here.'}
              action={canVote ? 'Add a track' : undefined}
              onAction={addTrack}
            />
          )}
          {canVote && upcoming.length ? (
            <div className="self-start">
              <Button title="Add a track" icon={IoAdd} variant="secondary" size="sm" onClick={addTrack} />
            </div>
          ) : null}
        </section>
      </div>
    </Page>
  );
}

// A pill with the vote count; filled when you've voted. Click again to remove.
function VoteButton({ track, canVote, onClick }: { track: QueueTrack; canVote: boolean; onClick: () => void }) {
  const on = track.votedByMe;
  const Icon = on ? IoArrowUpCircle : IoArrowUpCircleOutline;
  return (
    <button
      type="button"
      className={`vote${on ? ' on' : ''}`}
      onClick={onClick}
      disabled={!canVote}
      aria-pressed={on}
      aria-label={`${on ? 'Remove vote for' : 'Vote for'} ${track.title}, ${track.score} votes`}
      title={canVote ? (on ? 'Remove my vote' : 'Vote for it') : undefined}
    >
      <Icon size={20} aria-hidden />
      <span>{track.score}</span>
    </button>
  );
}

import type { PlaylistTracksView, PlaylistTrackView, PlaylistView } from '@music-room/shared';
import { useCallback, useState, type ReactNode } from 'react';
import { IoAdd, IoChevronDown, IoChevronUp, IoClose, IoInformationCircleOutline, IoLockClosedOutline, IoMusicalNotes, IoMusicalNotesOutline, IoPause, IoPlay, IoStatsChart } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { useLoadOnShow } from '@/lib/useLoad';
import { toPlayerTrack, usePlayer } from '@/player/PlayerProvider';
import { EDIT_DENY_MESSAGE, playlistSubtitle } from '@/playlists/labels';
import { afterIdAt, guessPosition, sorted } from '@/playlists/order';
import { SortableList } from '@/playlists/SortableList';
import { usePlaylistRealtime } from '@/realtime/usePlaylistRealtime';
import { useSession } from '@/session/SessionProvider';
import { Button, Cover, EmptyState, IconButton, LiveDot, Notice, Page, PageHeader, PageStatus, useDialogs } from '@/ui';

// A playlist's tracks: listen, and (if you can edit) add, remove and reorder.
// Every edit is shown at once, sent to the API, and confirmed by the
// server's answer and the live messages; other people's edits arrive live.
export function PlaylistPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const { alert, confirm } = useDialogs();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrackView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What plays comes from the app-wide player: it keeps playing (and the
  // ▶ stays on the right row) even after you leave this page.
  const player = usePlayer();
  const playingHere = player.source?.kind === 'playlist' && player.source.id === id;
  const playingId = playingHere ? (player.track?.id ?? null) : null;

  const loadDetails = useCallback(async () => {
    setPlaylist(await authedApi<PlaylistView>(`/playlists/${id}`));
  }, [authedApi, id]);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([authedApi<PlaylistView>(`/playlists/${id}`), authedApi<PlaylistTracksView>(`/playlists/${id}/tracks`)]);
      setPlaylist(p);
      setTracks(t.tracks);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the playlist');
    }
  }, [authedApi, id]);

  useLoadOnShow(useCallback(() => void load(), [load]));

  // ---------- applying changes (mine and everyone else's) ----------

  const upsert = (track: PlaylistTrackView) => setTracks((list) => (list ? sorted([...list.filter((t) => t.id !== track.id), track]) : list));
  const setPosition = (trackId: string, position: string) =>
    setTracks((list) => (list ? sorted(list.map((t) => (t.id === trackId ? { ...t, position } : t))) : list));
  const drop = (trackId: string) => setTracks((list) => (list ? list.filter((t) => t.id !== trackId) : list));

  const realtime = usePlaylistRealtime(id, {
    onAdded: upsert,
    onMoved: setPosition,
    onRemoved: drop,
    onUpdated: () => void loadDetails().catch(() => undefined),
    onGone: (why) => {
      if (playingHere) player.stop();
      void alert(why === 'deleted' ? 'Playlist deleted' : 'No access', 'This playlist is no longer available.');
      navigate('/playlists', { replace: true });
    },
    onJoined: () => void load(),
  });

  // Something went wrong (e.g. a 409 because the neighbour just moved or
  // vanished): say it, and take the server's list as the truth.
  const recover = (err: unknown, fallback: string) => {
    setError(err instanceof ApiError ? err.message : fallback);
    void load();
  };

  if (!playlist || !tracks) return <PageStatus error={error} back="/playlists" />;

  const canEdit = playlist.canEdit.allowed;
  const play = (t: PlaylistTrackView) => player.playPlaylist({ kind: 'playlist', id: playlist.id, name: playlist.name }, toPlayerTrack(t));

  const moveTo = (from: number, to: number) => {
    const list = [...tracks];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const guess = guessPosition(list[to - 1], list[to + 1]);
    setTracks(guess ? list.map((t) => (t.id === moved.id ? { ...t, position: guess } : t)) : list);
    setError(null);
    authedApi<PlaylistTrackView>(`/playlists/${id}/tracks/${moved.id}`, { method: 'PATCH', body: { afterId: afterIdAt(list, to) } }).then(
      (res) => setPosition(res.id, res.position),
      (err: unknown) => recover(err, 'Could not move the track'),
    );
  };

  const remove = async (track: PlaylistTrackView) => {
    if (!(await confirm({ title: 'Remove track?', message: `“${track.title}” will be removed for everyone.`, confirm: 'Remove', destructive: true }))) return;
    drop(track.id);
    setError(null);
    authedApi(`/playlists/${id}/tracks/${track.id}`, { method: 'DELETE' }).catch((err: unknown) => recover(err, 'Could not remove the track'));
  };

  const renderRow = (item: PlaylistTrackView, index: number, handle: ReactNode) => {
    const playing = item.id === playingId;
    return (
      <div className="track-row">
        <button
          type="button"
          className="track-main"
          onClick={() => (playing ? player.togglePause() : play(item))}
          aria-label={`${index + 1}. ${item.title} by ${item.artist}. ${playing ? (player.playing ? 'Playing — pause' : 'Paused — resume') : 'Play'}`}
        >
          <span className="track-index">
            {playing ? (
              <IoStatsChart size={14} color="var(--accent)" aria-hidden />
            ) : (
              <>
                <span className="num">{index + 1}</span>
                <span className="hover-play">
                  <IoPlay size={14} aria-hidden />
                </span>
              </>
            )}
          </span>
          <Cover uri={item.coverUrl} size={44} />
          <span className="list-item-text">
            <span className={`list-item-title${playing ? ' playing-title' : ''}`}>{item.title}</span>
            <span className="caption ellipsis">
              {item.artist}
              {item.addedBy ? ` · ${item.addedBy.displayName}` : ''}
            </span>
          </span>
        </button>
        {canEdit ? (
          <div className="tools">
            <IconButton className="arrow" icon={IoChevronUp} label={`Move ${item.title} up`} size={32} disabled={index === 0} onClick={() => moveTo(index, index - 1)} />
            <IconButton className="arrow" icon={IoChevronDown} label={`Move ${item.title} down`} size={32} disabled={index === tracks.length - 1} onClick={() => moveTo(index, index + 1)} />
            <IconButton icon={IoClose} label={`Remove ${item.title}`} size={32} onClick={() => void remove(item)} />
            {handle}
          </div>
        ) : null}
      </div>
    );
  };

  const addTracks = () => navigate(`/playlists/${playlist.id}/add`);

  return (
    <Page>
      <PageHeader
        back="/playlists"
        title={playlist.name}
        subtitle={`by ${playlist.owner.displayName}`}
        right={
          <>
            <LiveDot status={realtime} />
            <IconButton icon={IoInformationCircleOutline} label="Playlist info and invite" onClick={() => navigate(`/playlists/${playlist.id}/info`)} />
          </>
        }
      />

      <div className="hero">
        <Cover uris={tracks.slice(0, 4).map((t) => t.coverUrl)} uri={tracks[0]?.coverUrl} size={180} icon={IoMusicalNotes} />
        <div className="hero-text">
          <p className="muted clamp-2">{playlistSubtitle({ ...playlist, trackCount: tracks.length })}</p>
          {playlist.description ? <p className="clamp-2">{playlist.description}</p> : null}
          <div className="row">
            {tracks.length ? (
              <IconButton
                icon={playingHere && player.playing ? IoPause : IoPlay}
                label={playingHere ? (player.playing ? 'Pause' : 'Resume') : 'Play from the top'}
                variant="filled"
                size={52}
                onClick={() => (playingHere ? player.togglePause() : play(tracks[0]))}
              />
            ) : null}
            {canEdit ? <Button title="Add" icon={IoAdd} size="sm" variant="secondary" onClick={addTracks} /> : null}
          </div>
        </div>
      </div>

      {canEdit ? null : <Notice icon={IoLockClosedOutline}>{EDIT_DENY_MESSAGE[playlist.canEdit.reason]}</Notice>}
      {error ? <p className="error">{error}</p> : null}

      {tracks.length ? (
        <SortableList
          items={tracks}
          keyOf={(t) => t.id}
          enabled={canEdit}
          onMove={moveTo}
          renderRow={renderRow}
          handleLabel={(t) => `Reorder ${t.title}: press Space, then the arrow keys`}
        />
      ) : (
        <EmptyState
          icon={IoMusicalNotesOutline}
          title="No tracks yet"
          text={canEdit ? 'Add the first one — everyone here will see it live.' : 'Tracks will show up here.'}
          action={canEdit ? 'Add tracks' : undefined}
          onAction={addTracks}
        />
      )}
      {canEdit && tracks.length > 1 ? <p className="caption center">Click a track to play it · drag the handle, or use the arrows, to reorder</p> : null}
    </Page>
  );
}

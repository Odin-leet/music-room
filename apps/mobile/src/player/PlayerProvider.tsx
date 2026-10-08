import type { BroadcastTrack, PlaylistTracksView, QueueBroadcast, TrackPreview } from '@music-room/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';

// What is playing, and from where.
//   event:    the owner's phone is the party's speaker (Track Vote) — at the
//             end of a preview it moves the queue on (POST /next)
//   playlist: listening to a playlist on this phone — at the end of a
//             preview it plays the next track in the playlist's CURRENT order
export type PlayerSource = { kind: 'event' | 'playlist'; id: string; name: string };
export type PlayerTrack = {
  id: string; // the queue / playlist entry id
  providerTrackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
};

type Player = {
  source: PlayerSource | null;
  track: PlayerTrack | null;
  playing: boolean;
  buffering: boolean;
  positionSec: number;
  durationSec: number;
  error: string | null;
  busy: boolean;
  // Track Vote (owner): play `current`, or start the queue if nothing plays yet.
  playEvent: (source: PlayerSource, current: PlayerTrack | null) => void;
  // Playlist: play `track`, then go on in the playlist's order.
  playPlaylist: (source: PlayerSource, track: PlayerTrack) => void;
  togglePause: () => void;
  next: () => void;
  stop: () => void;
  // The party's queue changed (live update): follow its "now playing".
  onEventQueue: (eventId: string, queue: { nowPlaying: BroadcastTrack | null }) => void;
};

const PlayerContext = createContext<Player | null>(null);

export const toPlayerTrack = (t: BroadcastTrack | PlayerTrack): PlayerTrack => ({
  id: t.id,
  providerTrackId: t.providerTrackId,
  title: t.title,
  artist: t.artist,
  coverUrl: t.coverUrl,
});

// One audio player for the whole signed-in app, so the music keeps playing
// whichever screen you're on (the mini-player above the tabs controls it).
// One source at a time: starting another asks first.
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { authedApi } = useSession();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The end-of-track listener and async loads need the latest values.
  const sourceRef = useRef(source);
  const trackRef = useRef(track);
  const loadId = useRef(0); // ignores a preview that arrives after another one was asked for
  const advancing = useRef(false);
  const lastIndex = useRef(0); // playlist: where we were, if the current track gets removed
  const nextRef = useRef<() => void>(() => undefined); // set below, once `next` exists
  useEffect(() => {
    sourceRef.current = source;
    trackRef.current = track;
  });

  const clear = useCallback(() => {
    loadId.current += 1;
    player.pause();
    setSource(null);
    setTrack(null);
  }, [player]);

  // Fetch a fresh preview link (they expire after ~15 min) and play it.
  // No preview for this track: skip to the next one, like at its end.
  const load = useCallback(
    (t: PlayerTrack) => {
      const id = ++loadId.current;
      setTrack(t);
      setError(null);
      authedApi<TrackPreview>(`/music/tracks/${t.providerTrackId}/preview`).then(
        (preview) => {
          if (id !== loadId.current) return;
          player.replace({ uri: preview.url });
          player.play();
        },
        () => {
          if (id !== loadId.current) return;
          setError(`No preview for “${t.title}” — skipping it`);
          nextRef.current();
        },
      );
    },
    [authedApi, player],
  );

  // ---------- Track Vote (owner's phone) ----------

  // POST /next with the track we think is playing: if someone already moved
  // on, the server does nothing, so a double tap can't skip two songs.
  const advanceEvent = useCallback(
    async (src: PlayerSource, currentId: string | null) => {
      if (advancing.current) return;
      advancing.current = true;
      setBusy(true);
      try {
        const queue = await authedApi<QueueBroadcast>(`/events/${src.id}/next`, {
          method: 'POST',
          body: { currentTrackId: currentId },
        });
        if (sourceRef.current?.id !== src.id) return; // switched to something else meanwhile
        if (!queue.nowPlaying) return clear(); // the queue is empty
        // The live update may have arrived first and already loaded it.
        if (queue.nowPlaying.id === trackRef.current?.id) return;
        load(toPlayerTrack(queue.nowPlaying));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not change track');
      } finally {
        advancing.current = false;
        setBusy(false);
      }
    },
    [authedApi, clear, load],
  );

  // ---------- Playlist ----------

  // The track after the current one in the playlist's order NOW (others may
  // have moved or removed tracks since it started).
  const advancePlaylist = useCallback(
    async (src: PlayerSource) => {
      setBusy(true);
      try {
        const { tracks } = await authedApi<PlaylistTracksView>(`/playlists/${src.id}/tracks`);
        if (sourceRef.current?.id !== src.id) return;
        const i = tracks.findIndex((t) => t.id === trackRef.current?.id);
        const next = i >= 0 ? tracks[i + 1] : tracks[lastIndex.current];
        if (!next) return clear(); // end of the playlist
        lastIndex.current = tracks.indexOf(next);
        load(toPlayerTrack(next));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the next track');
      } finally {
        setBusy(false);
      }
    },
    [authedApi, clear, load],
  );

  // ---------- switching sources ----------

  // Another source is playing: ask before replacing it.
  const takeOver = useCallback((target: PlayerSource, start: () => void) => {
    const current = sourceRef.current;
    if (!current || (current.kind === target.kind && current.id === target.id)) return start();
    const what = current.kind === 'event' ? `the party “${current.name}”` : `the playlist “${current.name}”`;
    Alert.alert('Stop the music?', `This phone is playing ${what}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: start },
    ]);
  }, []);

  const playEvent = useCallback(
    (src: PlayerSource, current: PlayerTrack | null) =>
      takeOver(src, () => {
        setSource(src);
        if (current) load(current);
        else void advanceEvent(src, null);
      }),
    [advanceEvent, load, takeOver],
  );

  const playPlaylist = useCallback(
    (src: PlayerSource, t: PlayerTrack) =>
      takeOver(src, () => {
        setSource(src);
        load(t);
      }),
    [load, takeOver],
  );

  const next = useCallback(() => {
    const src = sourceRef.current;
    if (!src) return;
    if (src.kind === 'event') void advanceEvent(src, trackRef.current?.id ?? null);
    else void advancePlaylist(src);
  }, [advanceEvent, advancePlaylist]);

  // A preview ended: go on by itself.
  useEffect(() => {
    nextRef.current = next;
  });
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) nextRef.current();
    });
    return () => sub.remove();
  }, [player]);

  // A live queue update for the party we play: follow its "now playing"
  // (e.g. the owner pressed Next on another of their devices).
  const onEventQueue = useCallback(
    (eventId: string, queue: { nowPlaying: BroadcastTrack | null }) => {
      const src = sourceRef.current;
      if (src?.kind !== 'event' || src.id !== eventId) return;
      if (!queue.nowPlaying) clear();
      else if (queue.nowPlaying.id !== trackRef.current?.id) {
        load(toPlayerTrack(queue.nowPlaying));
      }
    },
    [clear, load],
  );

  const value = useMemo<Player>(
    () => ({
      source,
      track,
      playing: status.playing,
      buffering: status.isBuffering,
      positionSec: Math.floor(status.currentTime),
      durationSec: Math.round(status.duration || 30),
      error,
      busy,
      playEvent,
      playPlaylist,
      togglePause: () => (status.playing ? player.pause() : player.play()),
      next,
      stop: clear,
      onEventQueue,
    }),
    [source, track, status.playing, status.isBuffering, status.currentTime, status.duration, error, busy, playEvent, playPlaylist, player, next, clear, onEventQueue],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}

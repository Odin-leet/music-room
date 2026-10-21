import type { BroadcastTrack, PlaylistTracksView, QueueBroadcast, TrackPreview } from '@music-room/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { storage } from '@/lib/storage';
import { useSession } from '@/session/SessionProvider';
import { useDialogs } from '@/ui';

// What is playing, and from where (same model as the mobile app):
//   event:    the owner's browser is the party's speaker (Track Vote) — at the
//             end of a preview it moves the queue on (POST /next)
//   playlist: listening to a playlist here — at the end of a preview it
//             plays the next track in the playlist's CURRENT order
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
  volume: number; // 0..1
  error: string | null;
  busy: boolean;
  // Track Vote (owner): play `current`, or start the queue if nothing plays yet.
  playEvent: (source: PlayerSource, current: PlayerTrack | null) => void;
  // Playlist: play `track`, then go on in the playlist's order.
  playPlaylist: (source: PlayerSource, track: PlayerTrack) => void;
  togglePause: () => void;
  next: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
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

const VOLUME_KEY = 'holy.volume';

// The one <audio> element: a browser object, not React state (React must
// not own something it then mutates). Created on first use.
let element: HTMLAudioElement | null = null;
const getAudio = () => (element ??= new Audio());

// One <audio> for the whole signed-in app, so the music keeps playing
// whichever page you're on (the player bar controls it). One source at a
// time: starting another asks first.
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { authedApi } = useSession();
  const { confirm } = useDialogs();
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(30);
  const [volume, setVolumeState] = useState(() => {
    const v = Number(storage.get(VOLUME_KEY));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8;
  });
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

  useEffect(() => {
    getAudio().volume = volume;
  }, [volume]);

  // The <audio> element's state -> React state.
  useEffect(() => {
    const audio = getAudio();
    const on = (type: string, fn: () => void) => {
      audio.addEventListener(type, fn);
      return () => audio.removeEventListener(type, fn);
    };
    const offs = [
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('waiting', () => setBuffering(true)),
      on('playing', () => setBuffering(false)),
      on('canplay', () => setBuffering(false)),
      on('timeupdate', () => setPositionSec(Math.floor(getAudio().currentTime))),
      on('durationchange', () => setDurationSec(Math.round(getAudio().duration) || 30)),
      // A preview ended: go on by itself.
      on('ended', () => nextRef.current()),
    ];
    return () => {
      offs.forEach((off) => off());
      // Signed out (the provider is gone): silence.
      getAudio().pause();
      getAudio().removeAttribute('src');
    };
  }, []);

  const clear = useCallback(() => {
    loadId.current += 1;
    getAudio().pause();
    getAudio().removeAttribute('src');
    setPositionSec(0);
    setSource(null);
    setTrack(null);
  }, []);

  // Fetch a fresh preview link (they expire after ~15 min) and play it.
  // No preview for this track: skip to the next one, like at its end.
  const load = useCallback(
    (t: PlayerTrack) => {
      const id = ++loadId.current;
      setTrack(t);
      setError(null);
      setPositionSec(0);
      authedApi<TrackPreview>(`/music/tracks/${t.providerTrackId}/preview`).then(
        (preview) => {
          if (id !== loadId.current) return;
          getAudio().src = preview.url;
          getAudio().play().catch((err: unknown) => {
            if (id !== loadId.current) return;
            // The browser blocks sound until the page has been clicked once.
            if (err instanceof DOMException && err.name === 'NotAllowedError') setError('Press play to start the music.');
          });
        },
        () => {
          if (id !== loadId.current) return;
          setError(`No preview for “${t.title}” — skipping it`);
          nextRef.current();
        },
      );
    },
    [authedApi],
  );

  // ---------- Track Vote (owner's browser) ----------

  // POST /next with the track we think is playing: if someone already moved
  // on, the server does nothing, so a double click can't skip two songs.
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
  const takeOver = useCallback(
    async (target: PlayerSource, start: () => void) => {
      const current = sourceRef.current;
      if (!current || (current.kind === target.kind && current.id === target.id)) return start();
      const what = current.kind === 'event' ? `the party “${current.name}”` : `the playlist “${current.name}”`;
      if (await confirm({ title: 'Stop the music?', message: `This browser is playing ${what}.`, confirm: 'Switch' })) start();
    },
    [confirm],
  );

  const playEvent = useCallback(
    (src: PlayerSource, current: PlayerTrack | null) =>
      void takeOver(src, () => {
        setSource(src);
        if (current) load(current);
        else void advanceEvent(src, null);
      }),
    [advanceEvent, load, takeOver],
  );

  const playPlaylist = useCallback(
    (src: PlayerSource, t: PlayerTrack) =>
      void takeOver(src, () => {
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

  useEffect(() => {
    nextRef.current = next;
  });

  const togglePause = useCallback(() => {
    if (getAudio().paused) {
      setError(null);
      void getAudio().play().catch(() => undefined);
    } else getAudio().pause();
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    storage.set(VOLUME_KEY, String(clamped));
  }, []);

  // A live queue update for the party we play: follow its "now playing"
  // (e.g. the owner pressed Next on another of their devices).
  const onEventQueue = useCallback(
    (eventId: string, queue: { nowPlaying: BroadcastTrack | null }) => {
      const src = sourceRef.current;
      if (src?.kind !== 'event' || src.id !== eventId) return;
      if (!queue.nowPlaying) clear();
      else if (queue.nowPlaying.id !== trackRef.current?.id) load(toPlayerTrack(queue.nowPlaying));
    },
    [clear, load],
  );

  // Media keys, headphones and the OS's "now playing" (Media Session API).
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: source ? `HOLY · ${source.name}` : 'HOLY',
          artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '250x250' }] : [],
        })
      : null;
    ms.setActionHandler('play', track ? togglePause : null);
    ms.setActionHandler('pause', track ? togglePause : null);
    ms.setActionHandler('nexttrack', track ? next : null);
  }, [track, source, togglePause, next]);

  // The tab's title shows what plays.
  useEffect(() => {
    document.title = track && playing ? `▶ ${track.title} · ${track.artist} — HOLY` : 'HOLY';
  }, [track, playing]);

  const value = useMemo<Player>(
    () => ({
      source,
      track,
      playing,
      buffering,
      positionSec,
      durationSec,
      volume,
      error,
      busy,
      playEvent,
      playPlaylist,
      togglePause,
      next,
      stop: clear,
      setVolume,
      onEventQueue,
    }),
    [source, track, playing, buffering, positionSec, durationSec, volume, error, busy, playEvent, playPlaylist, togglePause, next, clear, setVolume, onEventQueue],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}

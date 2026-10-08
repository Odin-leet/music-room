import type {
  PlaylistClientToServerEvents,
  PlaylistServerToClientEvents,
  PlaylistTrackView,
} from '@music-room/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CLIENT_INFO } from '@/api/clientInfo';
import { getApiUrl } from '@/config';
import type { RealtimeStatus } from '@/events/useEventRealtime';
import { useSession } from '@/session/SessionProvider';

type Handlers = {
  onAdded: (track: PlaylistTrackView) => void;
  onMoved: (trackId: string, position: string) => void;
  onRemoved: (trackId: string) => void;
  // Name / license / memberships changed: refetch the details.
  onUpdated: () => void;
  // The playlist was deleted, or you can no longer see it.
  onGone: (why: 'deleted' | 'access-lost') => void;
  // (Re)joined the room: reload the tracks, since changes made while away
  // were missed (join first, then load: docs/realtime.md).
  onJoined: () => void;
};

// Live updates for one playlist (namespace /playlists). The socket only
// receives small change messages; edits still go through the REST API.
export function usePlaylistRealtime(playlistId: string, handlers: Handlers): RealtimeStatus {
  const { getAccessToken, refreshAccessToken } = useSession();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  // Latest handlers without reconnecting every render.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const socket: Socket<PlaylistServerToClientEvents, PlaylistClientToServerEvents> = io(`${getApiUrl()}/playlists`, {
      // A function: called on every (re)connect, so it always sends the latest token.
      auth: (cb) => cb({ token: getAccessToken(), client: CLIENT_INFO }),
      transports: ['websocket'],
    });
    const mine = (id: string) => id === playlistId;

    socket.on('connect', () => {
      void socket.emitWithAck('playlist:join', { playlistId }).then((res) => {
        if (res.ok) {
          setStatus('live');
          handlersRef.current.onJoined();
        } else {
          handlersRef.current.onGone('access-lost');
        }
      });
    });

    socket.on('disconnect', () => setStatus('offline'));

    // 'unauthorized' = the access token expired: refresh it, then try again.
    socket.on('connect_error', (err) => {
      setStatus('offline');
      if (err.message !== 'unauthorized') return; // network: socket.io retries by itself
      void refreshAccessToken().then((token) => {
        if (token) socket.connect();
      });
    });

    socket.on('track:added', (p) => mine(p.playlistId) && handlersRef.current.onAdded(p.track));
    socket.on('track:moved', (p) => mine(p.playlistId) && handlersRef.current.onMoved(p.trackId, p.position));
    socket.on('track:removed', (p) => mine(p.playlistId) && handlersRef.current.onRemoved(p.trackId));
    socket.on('playlist:updated', (p) => mine(p.playlistId) && handlersRef.current.onUpdated());
    socket.on('playlist:deleted', (p) => mine(p.playlistId) && handlersRef.current.onGone('deleted'));
    socket.on('playlist:access-lost', (p) => mine(p.playlistId) && handlersRef.current.onGone('access-lost'));

    return () => {
      socket.close();
    };
  }, [playlistId, getAccessToken, refreshAccessToken]);

  return status;
}

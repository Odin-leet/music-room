import type { ClientToServerEvents, QueueBroadcast, ServerToClientEvents } from '@music-room/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CLIENT_INFO } from '@/api/clientInfo';
import { API_URL } from '@/config';
import { useSession } from '@/session/SessionProvider';

type Handlers = {
  onQueue: (queue: QueueBroadcast) => void;
  onEventUpdated: () => void;
  // The event was deleted, or you can no longer see it.
  onGone: (why: 'deleted' | 'access-lost') => void;
  // (Re)joined the room: reload anything that may have changed while away.
  onJoined: () => void;
};

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

// Live updates for one Track Vote event (docs/realtime.md). The socket only
// receives; votes and suggestions still go through the REST API.
export function useEventRealtime(eventId: string, handlers: Handlers): RealtimeStatus {
  const { getAccessToken, refreshAccessToken } = useSession();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  // Latest handlers without reconnecting every render.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(`${API_URL}/events`, {
      // A function: called on every (re)connect, so it always sends the latest token.
      auth: (cb) => cb({ token: getAccessToken(), client: CLIENT_INFO }),
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      void socket.emitWithAck('event:join', { eventId }).then((res) => {
        if (res.ok) {
          setStatus('live');
          handlersRef.current.onJoined();
        } else {
          handlersRef.current.onGone('access-lost');
        }
      });
    });

    socket.on('disconnect', () => setStatus('offline'));

    // Refused at connection time. 'unauthorized' = the access token expired
    // (15 min): get a new one through the shared refresh, then try again.
    socket.on('connect_error', (err) => {
      setStatus('offline');
      if (err.message !== 'unauthorized') return; // network: socket.io retries by itself
      void refreshAccessToken().then((token) => {
        if (token) socket.connect(); // otherwise the session has ended and the app signs out
      });
    });

    socket.on('queue:updated', (q) => {
      if (q.eventId === eventId) handlersRef.current.onQueue(q);
    });
    socket.on('event:updated', ({ eventId: id }) => {
      if (id === eventId) handlersRef.current.onEventUpdated();
    });
    socket.on('event:deleted', ({ eventId: id }) => {
      if (id === eventId) handlersRef.current.onGone('deleted');
    });
    socket.on('event:access-lost', ({ eventId: id }) => {
      if (id === eventId) handlersRef.current.onGone('access-lost');
    });

    return () => {
      socket.close();
    };
  }, [eventId, getAccessToken, refreshAccessToken]);

  return status;
}

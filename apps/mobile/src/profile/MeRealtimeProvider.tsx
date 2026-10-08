import type { FriendRequestsView, MeServerToClientEvents } from '@music-room/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CLIENT_INFO } from '@/api/clientInfo';
import { getApiUrl } from '@/config';
import { useSession } from '@/session/SessionProvider';

type Listener = (otherUserId: string) => void;

type MeRealtime = {
  // Friend requests waiting for your answer (the badge on Home).
  incomingRequests: number;
  subscribe: (listener: Listener) => () => void;
};

const MeRealtimeContext = createContext<MeRealtime | null>(null);

// One /me socket for the whole logged-in app (docs/realtime.md). The server
// tells us when something changed between us and someone (a friend request
// sent / accepted / declined / cancelled, an unfriend); screens that show
// friends reload, and the waiting-requests count is refreshed.
export function MeRealtimeProvider({ children }: { children: ReactNode }) {
  const { authedApi, getAccessToken, refreshAccessToken } = useSession();
  const [incomingRequests, setIncomingRequests] = useState(0);
  const listeners = useRef(new Set<Listener>());

  const refreshCount = useCallback(() => {
    authedApi<FriendRequestsView>('/friends/requests').then(
      (r) => setIncomingRequests(r.incoming.length),
      () => undefined, // the badge is a hint; screens show real errors
    );
  }, [authedApi]);

  useEffect(() => {
    const socket: Socket<MeServerToClientEvents> = io(`${getApiUrl()}/me`, {
      // A function: called on every (re)connect, so it always sends the latest token.
      auth: (cb) => cb({ token: getAccessToken(), client: CLIENT_INFO }),
      transports: ['websocket'],
    });
    // (Re)connected: anything may have changed while we were away.
    socket.on('connect', () => {
      refreshCount();
      listeners.current.forEach((l) => l(''));
    });
    // 'unauthorized' = the access token expired: refresh it, then try again.
    socket.on('connect_error', (err) => {
      if (err.message !== 'unauthorized') return; // network: socket.io retries by itself
      void refreshAccessToken().then((token) => {
        if (token) socket.connect();
      });
    });
    socket.on('friends:changed', ({ userId }) => {
      refreshCount();
      listeners.current.forEach((l) => l(userId));
    });
    return () => {
      socket.close();
    };
  }, [getAccessToken, refreshAccessToken, refreshCount]);

  const value = useMemo<MeRealtime>(
    () => ({
      incomingRequests,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [incomingRequests],
  );

  return <MeRealtimeContext.Provider value={value}>{children}</MeRealtimeContext.Provider>;
}

export function useIncomingRequests() {
  const ctx = useContext(MeRealtimeContext);
  if (!ctx) throw new Error('useIncomingRequests must be used inside MeRealtimeProvider');
  return ctx.incomingRequests;
}

// Calls `onChange(otherUserId)` whenever something changes between you and
// someone ('' after a reconnect: assume anything changed).
export function useFriendsChanged(onChange: Listener) {
  const ctx = useContext(MeRealtimeContext);
  if (!ctx) throw new Error('useFriendsChanged must be used inside MeRealtimeProvider');
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  const { subscribe } = ctx;
  useEffect(() => subscribe((id) => latest.current(id)), [subscribe]);
}

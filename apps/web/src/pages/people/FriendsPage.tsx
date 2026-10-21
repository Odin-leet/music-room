import type { FriendRequestsView, FriendshipResult, FriendView, UserSummary } from '@music-room/shared';
import { useCallback, useEffect, useState } from 'react';
import { IoCheckmark, IoClose, IoPeopleOutline, IoSearchOutline } from 'react-icons/io5';
import { ApiError } from '@/api/client';
import { useLoadOnShow } from '@/lib/useLoad';
import { PersonRow } from '@/profile/PersonRow';
import { useFriendsChanged } from '@/realtime/MeRealtimeProvider';
import { useSession } from '@/session/SessionProvider';
import { Actions, EmptyState, IconButton, Page, PageHeader, SearchBox, SectionHeader } from '@/ui';

// Friends: search people at the top; below, requests waiting for you, your
// friends, requests you sent. Live: reloads when /me says something changed.
export function FriendsPage() {
  const { authedApi } = useSession();
  const [requests, setRequests] = useState<FriendRequestsView | null>(null);
  const [friends, setFriends] = useState<FriendView[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([authedApi<FriendRequestsView>('/friends/requests'), authedApi<FriendView[]>('/friends')]);
      setRequests(r);
      setFriends(f);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your friends');
    }
  }, [authedApi]);

  useLoadOnShow(useCallback(() => void load(), [load]));
  useFriendsChanged(() => void load());

  // Search as you type (from 2 letters), a moment after the last key.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      authedApi<UserSummary[]>(`/users?q=${encodeURIComponent(q)}`)
        .then(
          (r) => !cancelled && setResults(r),
          () => !cancelled && setResults([]),
        )
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authedApi, q]);

  const act = async (userId: string, action: () => Promise<unknown>) => {
    setBusy(userId);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };
  const accept = (id: string) => act(id, () => authedApi<FriendshipResult>(`/friends/requests/${id}/accept`, { method: 'POST' }));
  const dropRequest = (id: string) => act(id, () => authedApi(`/friends/requests/${id}`, { method: 'DELETE' }));

  const searchingMode = q.length >= 2;

  return (
    <Page>
      <PageHeader title="Friends" />
      <SearchBox value={query} onChange={setQuery} placeholder="Find people by name" busy={searching} />
      {error ? <p className="error">{error}</p> : null}

      {searchingMode ? (
        results?.length ? (
          <ul className="list">
            {results.map((u) => (
              <li key={u.id}>
                <PersonRow person={u} />
              </li>
            ))}
          </ul>
        ) : results && !searching ? (
          <EmptyState icon={IoSearchOutline} title="Nobody found" text={`No one called “${q}”.`} />
        ) : null
      ) : (
        <>
          {requests?.incoming.length ? (
            <section>
              <SectionHeader title={`Requests · ${requests.incoming.length}`} />
              <ul className="list">
                {requests.incoming.map((r) => (
                  <li key={r.user.id}>
                    <PersonRow
                      person={r.user}
                      detail="Wants to be your friend"
                      trailing={
                        <Actions>
                          <IconButton icon={IoCheckmark} label={`Accept ${r.user.displayName}`} variant="filled" size={36} disabled={busy !== null} onClick={() => void accept(r.user.id)} />
                          <IconButton icon={IoClose} label={`Decline ${r.user.displayName}`} variant="tonal" size={36} disabled={busy !== null} onClick={() => void dropRequest(r.user.id)} />
                        </Actions>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionHeader title={`My friends${friends?.length ? ` · ${friends.length}` : ''}`} />
            {friends?.length ? (
              <ul className="list">
                {friends.map((f) => (
                  <li key={f.user.id}>
                    <PersonRow person={f.user} detail={`Friends since ${new Date(f.since).toLocaleDateString()}`} />
                  </li>
                ))}
              </ul>
            ) : friends ? (
              <EmptyState icon={IoPeopleOutline} title="No friends yet" text="Search for people above and add them." />
            ) : null}
          </section>

          {requests?.sent.length ? (
            <section>
              <SectionHeader title="Waiting for an answer" />
              <ul className="list">
                {requests.sent.map((r) => (
                  <li key={r.user.id}>
                    <PersonRow
                      person={r.user}
                      detail="Request sent"
                      trailing={
                        <Actions>
                          <IconButton icon={IoClose} label={`Cancel the request to ${r.user.displayName}`} variant="tonal" size={36} disabled={busy !== null} onClick={() => void dropRequest(r.user.id)} />
                        </Actions>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Page>
  );
}

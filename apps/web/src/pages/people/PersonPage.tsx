import type { FriendshipResult, UserProfile } from '@music-room/shared';
import { useCallback, useState, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { IoCheckmark, IoClose, IoCreateOutline, IoHeart, IoLockClosedOutline, IoMusicalNotesOutline, IoPeopleOutline, IoPersonAdd } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { useLoadOnShow } from '@/lib/useLoad';
import { GENRE_LABEL } from '@/profile/labels';
import { useFriendsChanged } from '@/realtime/MeRealtimeProvider';
import { useSession } from '@/session/SessionProvider';
import { Avatar, Button, Card, CardTitle, Page, PageHeader, PageStatus, useDialogs } from '@/ui';

// Someone's profile, as the API filtered it for you: only the tiers you may
// see are filled in (the app never decides that itself).
export function PersonPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const { confirm } = useDialogs();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await authedApi<UserProfile>(`/users/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this profile');
    }
  }, [authedApi, id]);

  useLoadOnShow(useCallback(() => void load(), [load]));
  // Live: they accepted / declined / unfriended -> what we may see changed.
  useFriendsChanged((otherId) => {
    if (!otherId || otherId === id.toLowerCase()) void load();
  });

  // Every friend action changes which tiers we may see: reload the profile.
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return <PageStatus error={error} back="/people" />;

  const name = profile.public.displayName;
  const request = () => authedApi<FriendshipResult>('/friends/requests', { method: 'POST', body: { userId: profile.id } });
  const accept = () => authedApi<FriendshipResult>(`/friends/requests/${profile.id}/accept`, { method: 'POST' });
  const dropRequest = () => authedApi(`/friends/requests/${profile.id}`, { method: 'DELETE' });
  const unfriend = async () => {
    if (await confirm({ title: `Unfriend ${name}?`, message: 'You will stop seeing each other’s friends-only info.', confirm: 'Unfriend', destructive: true })) {
      void act(() => authedApi(`/friends/${profile.id}`, { method: 'DELETE' }));
    }
  };

  return (
    <Page narrow>
      <PageHeader back="/people" title="" />
      <div className="stack-sm" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Avatar name={name} size={96} />
        <h1 className="title">{name}</h1>
        <p className="muted">{profile.public.bio || 'No bio yet.'}</p>

        {profile.relation === 'self' ? (
          <Button title="Edit my profile" icon={IoCreateOutline} size="sm" variant="secondary" onClick={() => navigate('/profile')} />
        ) : profile.friendship === 'none' ? (
          <Button title="Add friend" icon={IoPersonAdd} size="sm" loading={busy} onClick={() => void act(request)} />
        ) : profile.friendship === 'request_sent' ? (
          <>
            <p className="caption">Request sent. Waiting for {name}.</p>
            <Button title="Cancel request" icon={IoClose} size="sm" variant="secondary" loading={busy} onClick={() => void act(dropRequest)} />
          </>
        ) : profile.friendship === 'request_received' ? (
          <>
            <p className="caption">{name} wants to be your friend.</p>
            <div className="row">
              <Button title="Accept" icon={IoCheckmark} size="sm" loading={busy} onClick={() => void act(accept)} />
              <Button title="Decline" size="sm" variant="secondary" disabled={busy} onClick={() => void act(dropRequest)} />
            </div>
          </>
        ) : profile.friendship === 'friends' ? (
          <div className="row">
            <span className="row-sm success">
              <IoHeart size={16} aria-hidden /> Friends
            </span>
            <Button title="Unfriend" size="sm" variant="secondary" disabled={busy} onClick={() => void unfriend()} />
          </div>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}

      <Section icon={IoPeopleOutline} title="Friends only">
        {profile.friendsOnly ? (
          <>
            <Detail label="Real name" value={profile.friendsOnly.realName} />
            <Detail label="City" value={profile.friendsOnly.city} />
          </>
        ) : (
          <Hidden text={`Only ${name}’s friends can see this.`} />
        )}
      </Section>

      <Section icon={IoMusicalNotesOutline} title="Music taste">
        {profile.music ? (
          <>
            {profile.music.genres.length ? (
              <div className="chips">
                {profile.music.genres.map((g) => (
                  <span key={g} className="tag">
                    {GENRE_LABEL[g]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">No genres yet.</p>
            )}
            {profile.music.artists.length ? <p className="muted">Loves {profile.music.artists.join(', ')}</p> : null}
          </>
        ) : (
          <Hidden text={`${name} doesn’t share their music taste with you.`} />
        )}
      </Section>
      {/* The private tier is never sent for anyone but yourself. */}
    </Page>
  );
}

const Section = ({ icon, title, children }: { icon: IconType; title: string; children: ReactNode }) => (
  <Card roomy>
    <CardTitle icon={icon} title={title} />
    {children}
  </Card>
);

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <div className="row between">
    <span className="muted">{label}</span>
    <span>{value ?? '—'}</span>
  </div>
);

const Hidden = ({ text }: { text: string }) => (
  <div className="row-sm muted">
    <IoLockClosedOutline size={16} aria-hidden />
    <span>{text}</span>
  </div>
);

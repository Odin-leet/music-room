import { MUSIC_GENRES, type MusicGenre, type ProfileVisibility, type SignInMethods, type UserProfile } from '@music-room/shared';
import { useEffect, useState } from 'react';
import { IoCheckmark, IoChevronForward, IoClose, IoGlobeOutline, IoKeyOutline, IoLockClosedOutline, IoLogoFacebook, IoLogoGoogle, IoLogOutOutline, IoMailOutline, IoMusicalNotesOutline, IoPeopleOutline, IoServerOutline } from 'react-icons/io5';
import { useLocation } from 'react-router';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { GENRE_LABEL, TIER_HINT, VISIBILITY_LABEL } from '@/profile/labels';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { PROVIDER_NAME, startLink, type SocialProvider } from '@/session/oauthFlow';
import { useSession } from '@/session/SessionProvider';
import { Avatar, Button, Card, CardTitle, ChoiceChips, IconButton, ListItem, MultiChips, Page, PageStatus, TextField, useDialogs } from '@/ui';

const MAX_ARTISTS = 10;

// The form keeps text fields as strings ("" = empty); null only goes to the API.
type Draft = {
  displayName: string;
  bio: string;
  realName: string;
  city: string;
  phone: string;
  birthDate: string;
  musicGenres: MusicGenre[];
  musicArtists: string[];
  musicVisibility: ProfileVisibility;
};

const toDraft = (p: UserProfile): Draft => ({
  displayName: p.public.displayName,
  bio: p.public.bio,
  realName: p.friendsOnly?.realName ?? '',
  city: p.friendsOnly?.city ?? '',
  phone: p.private?.phone ?? '',
  birthDate: p.private?.birthDate ?? '',
  musicGenres: p.music?.genres ?? [],
  musicArtists: p.music?.artists ?? [],
  musicVisibility: p.musicVisibility ?? 'friends',
});

// Only the fields that changed, text trimmed, "" sent as null.
function changes(from: Draft, to: Draft) {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(to) as (keyof Draft)[]) {
    const a = from[key];
    const b = to[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    body[key] = typeof b === 'string' && ['realName', 'city', 'phone', 'birthDate'].includes(key) ? b.trim() || null : b;
  }
  return body;
}

// Back from linking Google / Facebook (/oauth puts the result here).
type LinkState = { linked?: SocialProvider; methods?: SignInMethods; linkError?: string } | null;

// Your own profile, grouped by who can see each part (brief V.1), plus the
// ways you can sign in.
export function ProfilePage() {
  const { authedApi } = useSession();
  const { me, reload: reloadMe } = useCurrentUser();
  const [saved, setSaved] = useState<Draft | null>(null); // what the server has
  const [draft, setDraft] = useState<Draft | null>(null); // what the form shows
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [notice, setNotice] = useState<string | null>(null);
  const [artist, setArtist] = useState('');

  useEffect(() => {
    let cancelled = false;
    authedApi<UserProfile>('/users/me/profile').then(
      (p) => {
        if (cancelled) return;
        setSaved(toDraft(p));
        setDraft(toDraft(p));
      },
      (err: unknown) => !cancelled && setLoadError(err instanceof ApiError ? err.message : 'Could not load your profile'),
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi]);

  if (!draft || !saved) return <PageStatus error={loadError} back="/" />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setNotice(null);
    setDraft({ ...draft, [key]: value });
  };
  const body = changes(saved, draft);
  const dirty = Object.keys(body).length > 0;

  const addArtist = () => {
    const name = artist.trim();
    if (!name) return;
    if (!draft.musicArtists.some((a) => a.toLowerCase() === name.toLowerCase())) set('musicArtists', [...draft.musicArtists, name]);
    setArtist('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setErrors(noErrors);
    setNotice(null);
    try {
      const p = await authedApi<UserProfile>('/users/me/profile', { method: 'PATCH', body });
      setSaved(toDraft(p));
      setDraft(toDraft(p));
      setNotice('Saved.');
      if ('displayName' in body) void reloadMe(); // Home shows the name
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page narrow>
      <div className="row" style={{ gap: 'var(--lg)' }}>
        <Avatar name={draft.displayName || '?'} size={64} />
        <div className="grow">
          <h1 className="title ellipsis">{draft.displayName}</h1>
          <p className="muted ellipsis">{me.state === 'ok' ? me.user.email : ''}</p>
        </div>
      </div>

      <form className="stack" onSubmit={(e) => void save(e)} noValidate>
        <Card roomy>
          <CardTitle icon={IoGlobeOutline} title="Public" hint={TIER_HINT.public} />
          <TextField label="Display name" value={draft.displayName} onChangeText={(v) => set('displayName', v)} error={errors.fields.displayName} maxLength={100} />
          <TextField label="Bio" placeholder="A few words about you and your music" value={draft.bio} onChangeText={(v) => set('bio', v)} error={errors.fields.bio} maxLength={300} multiline />
        </Card>

        <Card roomy>
          <CardTitle icon={IoPeopleOutline} title="Friends only" hint={TIER_HINT.friends} />
          <TextField label="Real name" value={draft.realName} onChangeText={(v) => set('realName', v)} error={errors.fields.realName} maxLength={100} autoComplete="name" />
          <TextField label="City" value={draft.city} onChangeText={(v) => set('city', v)} error={errors.fields.city} maxLength={100} autoComplete="address-level2" />
        </Card>

        <Card roomy>
          <CardTitle icon={IoLockClosedOutline} title="Private" hint={TIER_HINT.private} />
          <TextField label="Phone" type="tel" placeholder="+33 6 12 34 56 78" value={draft.phone} onChangeText={(v) => set('phone', v)} error={errors.fields.phone} maxLength={30} autoComplete="tel" />
          <TextField label="Birth date" type="date" value={draft.birthDate} onChangeText={(v) => set('birthDate', v)} error={errors.fields.birthDate} autoComplete="bday" />
        </Card>

        <Card roomy>
          <CardTitle icon={IoMusicalNotesOutline} title="Music preferences" />
          <ChoiceChips
            label="Who can see them"
            value={draft.musicVisibility}
            onChange={(v) => set('musicVisibility', v)}
            options={(['public', 'friends', 'private'] as const).map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
            hint={TIER_HINT.music[draft.musicVisibility]}
          />
          <MultiChips label="Genres" values={draft.musicGenres} onChange={(v) => set('musicGenres', v)} options={MUSIC_GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))} />
          {errors.fields.musicGenres ? <p className="error">{errors.fields.musicGenres}</p> : null}
          <div className="stack-sm">
            <span className="field-label">
              Favourite artists ({draft.musicArtists.length}/{MAX_ARTISTS})
            </span>
            {draft.musicArtists.length ? (
              <div className="chips">
                {draft.musicArtists.map((a) => (
                  <span key={a} className="tag row-sm" style={{ paddingRight: 4 }}>
                    {a}
                    <IconButton icon={IoClose} label={`Remove ${a}`} size={24} onClick={() => set('musicArtists', draft.musicArtists.filter((x) => x !== a))} />
                  </span>
                ))}
              </div>
            ) : null}
            {draft.musicArtists.length < MAX_ARTISTS ? (
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="grow">
                  <TextField
                    label="Add an artist"
                    placeholder="Daft Punk"
                    value={artist}
                    onChangeText={setArtist}
                    error={errors.fields.musicArtists}
                    maxLength={100}
                    onKeyDown={(e) => {
                      // Enter adds the artist instead of saving the whole form.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArtist();
                      }
                    }}
                  />
                </div>
                <Button title="Add" variant="secondary" disabled={!artist.trim()} onClick={addArtist} />
              </div>
            ) : null}
          </div>
        </Card>

        {errors.form ? <p className="error">{errors.form}</p> : null}
        {notice ? <p className="success">{notice}</p> : null}
        <Button type="submit" title="Save profile" icon={IoCheckmark} loading={saving} disabled={!dirty} block />
      </form>

      <SignInMethodsCard />

      <Card>
        <ListItem
          to="/settings"
          title="Server settings"
          subtitle="Which HOLY server this app talks to"
          leading={<IoServerOutline size={22} color="var(--accent)" aria-hidden />}
          trailing={<IoChevronForward className="chevron" size={18} aria-hidden />}
        />
        <LogOutButton />
      </Card>
    </Page>
  );
}

function LogOutButton() {
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <ListItem
      title={busy ? 'Logging out…' : 'Log out'}
      leading={<IoLogOutOutline size={22} color="var(--danger)" aria-hidden />}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void signOut();
      }}
    />
  );
}

// Password / Google / Facebook, with Link and Unlink.
function SignInMethodsCard() {
  const { authedApi } = useSession();
  const { confirm } = useDialogs();
  const back = useLocation().state as LinkState;
  const [methods, setMethods] = useState<SignInMethods | null>(back?.methods ?? null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(back?.linkError ?? null);
  const [notice, setNotice] = useState<string | null>(back?.linked ? `${PROVIDER_NAME[back.linked]} is linked.` : null);

  useEffect(() => {
    let cancelled = false;
    authedApi<SignInMethods>('/users/me/identities').then(
      (m) => !cancelled && setMethods(m),
      () => !cancelled && setError('Could not load your sign-in methods'),
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi]);

  // Off to the provider; /oauth confirms the link and comes back here.
  const link = (p: SocialProvider) => {
    setBusy(p);
    setError(null);
    setNotice(null);
    startLink(p, (body) => authedApi<{ url: string }>(`/auth/${p}/link`, { method: 'POST', body })).catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : `Linking ${PROVIDER_NAME[p]} failed. Please try again.`);
      setBusy(null);
    });
  };

  const unlink = async (p: SocialProvider) => {
    const name = PROVIDER_NAME[p];
    if (!(await confirm({ title: `Unlink ${name}?`, message: `You won't be able to sign in with ${name} any more.`, confirm: 'Unlink', destructive: true }))) return;
    setBusy(p);
    setError(null);
    setNotice(null);
    try {
      setMethods(await authedApi<SignInMethods>(`/users/me/identities/${p}`, { method: 'DELETE' }));
    } catch (err) {
      // e.g. 409: it's your only way to sign in
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardTitle icon={IoKeyOutline} title="Ways to sign in" />
      {methods ? (
        <>
          <ListItem
            title="Email and password"
            subtitle={methods.password ? `${methods.email} · password set` : `${methods.email} · no password yet ("Forgot password" sets one)`}
            leading={<IoMailOutline size={22} color="var(--accent)" aria-hidden />}
          />
          {(['google', 'facebook'] as const).map((p) => {
            const Icon = p === 'google' ? IoLogoGoogle : IoLogoFacebook;
            return (
              <ListItem
                key={p}
                title={PROVIDER_NAME[p]}
                subtitle={methods[p] ? 'Linked' : 'Not linked'}
                leading={<Icon size={22} color="var(--accent)" aria-hidden />}
                trailing={
                  <Button
                    title={methods[p] ? 'Unlink' : 'Link'}
                    size="sm"
                    variant={methods[p] ? 'secondary' : 'primary'}
                    loading={busy === p}
                    disabled={busy !== null && busy !== p}
                    onClick={() => (methods[p] ? void unlink(p) : link(p))}
                  />
                }
              />
            );
          })}
        </>
      ) : null}
      {notice ? <p className="success">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </Card>
  );
}

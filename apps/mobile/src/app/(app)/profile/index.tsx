import { MUSIC_GENRES, type MusicGenre, type ProfileVisibility, type SignInMethods, type UserProfile } from '@music-room/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { GENRE_LABEL, TIER_HINT, VISIBILITY_LABEL } from '@/profile/labels';
import { useLinkProvider } from '@/profile/useLinkProvider';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { SocialLoginError, useSession, type SocialProvider } from '@/session/SessionProvider';
import { colors, spacing } from '@/theme';
import { Button, Card, ChoiceChips, MultiChips, Screen, Text, TextField } from '@/ui';

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

// Your own profile, grouped by who can see each part (brief V.1), plus the
// ways you can sign in.
export default function MyProfileScreen() {
  const { authedApi } = useSession();
  const { reload: reloadMe } = useCurrentUser();
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
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load your profile');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi]);

  if (!draft || !saved) {
    return (
      <Screen centered>
        <Text variant={loadError ? 'error' : 'muted'}>{loadError ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setNotice(null);
    setDraft({ ...draft, [key]: value });
  };
  const body = changes(saved, draft);
  const dirty = Object.keys(body).length > 0;

  const addArtist = () => {
    const name = artist.trim();
    if (!name) return;
    if (draft.musicArtists.some((a) => a.toLowerCase() === name.toLowerCase())) {
      setArtist('');
      return;
    }
    set('musicArtists', [...draft.musicArtists, name]);
    setArtist('');
  };

  const save = async () => {
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
    <Screen form>
      <Text variant="title">My profile</Text>

      <Card>
        <Text variant="muted">Public</Text>
        <Text variant="muted">{TIER_HINT.public}</Text>
        <TextField
          label="Display name"
          value={draft.displayName}
          onChangeText={(v) => set('displayName', v)}
          error={errors.fields.displayName}
          maxLength={100}
        />
        <TextField
          label="Bio"
          placeholder="A few words about you and your music"
          value={draft.bio}
          onChangeText={(v) => set('bio', v)}
          error={errors.fields.bio}
          maxLength={300}
          multiline
        />
      </Card>

      <Card>
        <Text variant="muted">Friends only</Text>
        <Text variant="muted">{TIER_HINT.friends}</Text>
        <TextField
          label="Real name"
          value={draft.realName}
          onChangeText={(v) => set('realName', v)}
          error={errors.fields.realName}
          maxLength={100}
        />
        <TextField
          label="City"
          value={draft.city}
          onChangeText={(v) => set('city', v)}
          error={errors.fields.city}
          maxLength={100}
        />
      </Card>

      <Card>
        <Text variant="muted">Private</Text>
        <Text variant="muted">{TIER_HINT.private}</Text>
        <TextField
          label="Phone"
          placeholder="+33 6 12 34 56 78"
          value={draft.phone}
          onChangeText={(v) => set('phone', v)}
          error={errors.fields.phone}
          keyboardType="phone-pad"
          maxLength={30}
        />
        <TextField
          label="Birth date"
          placeholder="YYYY-MM-DD"
          value={draft.birthDate}
          onChangeText={(v) => set('birthDate', v)}
          error={errors.fields.birthDate}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </Card>

      <Card>
        <Text variant="muted">Music preferences</Text>
        <ChoiceChips
          label="Who can see them"
          value={draft.musicVisibility}
          onChange={(v) => set('musicVisibility', v)}
          options={(['public', 'friends', 'private'] as const).map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
          hint={TIER_HINT.music[draft.musicVisibility]}
        />
        <MultiChips
          label="Genres"
          values={draft.musicGenres}
          onChange={(v) => set('musicGenres', v)}
          options={MUSIC_GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))}
        />
        {errors.fields.musicGenres ? <Text variant="error">{errors.fields.musicGenres}</Text> : null}
        <Text variant="muted">
          Favourite artists ({draft.musicArtists.length}/{MAX_ARTISTS})
        </Text>
        {draft.musicArtists.map((a) => (
          <View key={a} style={styles.artist}>
            <Text style={styles.flex} numberOfLines={1}>
              {a}
            </Text>
            <Pressable
              onPress={() => set('musicArtists', draft.musicArtists.filter((x) => x !== a))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${a}`}
            >
              <Text variant="muted">✕</Text>
            </Pressable>
          </View>
        ))}
        {draft.musicArtists.length < MAX_ARTISTS ? (
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <TextField
                label="Add an artist"
                placeholder="Daft Punk"
                value={artist}
                onChangeText={setArtist}
                error={errors.fields.musicArtists}
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={addArtist}
              />
            </View>
            <Button title="Add" variant="secondary" disabled={!artist.trim()} onPress={addArtist} />
          </View>
        ) : null}
      </Card>

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      {notice ? <Text variant="success">{notice}</Text> : null}
      <Button title="Save profile" loading={saving} disabled={!dirty} onPress={() => void save()} />

      <SignInMethodsCard />

      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

function linkErrorMessage(err: unknown, name: string) {
  if (err instanceof SocialLoginError) {
    return err.code === 'access_denied' ? `${name} was cancelled.` : `Linking ${name} failed. Please try again.`;
  }
  if (err instanceof ApiError) return err.message; // e.g. 409 "already linked to another account"
  return 'Something went wrong. Please try again.';
}

// Password / Google / Facebook, with Link and Unlink.
function SignInMethodsCard() {
  const { authedApi } = useSession();
  const link = useLinkProvider();
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authedApi<SignInMethods>('/users/me/identities').then(
      (m) => {
        if (!cancelled) setMethods(m);
      },
      () => {
        if (!cancelled) setError('Could not load your sign-in methods');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi]);

  const run = async (provider: SocialProvider, action: () => Promise<SignInMethods | null>) => {
    setBusy(provider);
    setError(null);
    try {
      const m = await action();
      if (m) setMethods(m);
    } catch (err) {
      setError(linkErrorMessage(err, PROVIDER_NAME[provider]));
    } finally {
      setBusy(null);
    }
  };

  const unlink = (provider: SocialProvider) =>
    Alert.alert(`Unlink ${PROVIDER_NAME[provider]}?`, `You won't be able to sign in with ${PROVIDER_NAME[provider]} any more.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: () =>
          void run(provider, () => authedApi<SignInMethods>(`/users/me/identities/${provider}`, { method: 'DELETE' })),
      },
    ]);

  return (
    <Card>
      <Text variant="muted">Ways to sign in</Text>
      {methods ? (
        <>
          <Text>
            {methods.email} · {methods.password ? 'password set' : 'no password ("Forgot password" sets one)'}
          </Text>
          {(['google', 'facebook'] as const).map((p) => (
            <View key={p} style={styles.method}>
              <Text style={styles.flex}>
                {PROVIDER_NAME[p]}: {methods[p] ? 'linked' : 'not linked'}
              </Text>
              <Button
                title={methods[p] ? 'Unlink' : 'Link'}
                variant="secondary"
                loading={busy === p}
                disabled={busy !== null}
                onPress={() => (methods[p] ? unlink(p) : void run(p, () => link(p)))}
              />
            </View>
          ))}
        </>
      ) : null}
      {error ? <Text variant="error">{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  artist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  method: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

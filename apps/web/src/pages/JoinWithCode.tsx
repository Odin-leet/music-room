import { useState } from 'react';
import { useNavigate } from 'react-router';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useSession } from '@/session/SessionProvider';
import { Button, Page, PageHeader, TextField } from '@/ui';

// "Join an event" / "Join a playlist": the 8-character invite code.
export function JoinWithCode({ kind }: { kind: 'events' | 'playlists' }) {
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  // Codes are 8 characters; the API ignores case and spaces.
  const clean = code.replace(/\s+/g, '').toUpperCase();
  const canJoin = clean.length === 8 && !joining;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    setJoining(true);
    setErrors(noErrors);
    try {
      const joined = await authedApi<{ id: string }>(`/${kind}/join`, { method: 'POST', body: { inviteCode: clean } });
      navigate(`/${kind}/${joined.id}`, { replace: true });
    } catch (err) {
      setErrors(toFormErrors(err));
      setJoining(false);
    }
  };

  const event = kind === 'events';
  return (
    <Page narrow>
      <PageHeader back={`/${kind}`} title={event ? 'Join an event' : 'Join a playlist'} />
      <form className="stack" onSubmit={(e) => void join(e)} noValidate>
        <p className="muted">Enter the 8-character code the {event ? 'organiser' : 'owner'} shared with you.</p>
        <TextField
          label="Invite code"
          placeholder="ABCD2345"
          value={code}
          onChangeText={setCode}
          error={errors.fields.inviteCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          autoFocus
        />
        {errors.form ? <p className="error">{errors.form}</p> : null}
        <Button type="submit" title="Join" loading={joining} disabled={!canJoin} block />
      </form>
    </Page>
  );
}

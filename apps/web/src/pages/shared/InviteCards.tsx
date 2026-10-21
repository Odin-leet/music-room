import { useState } from 'react';
import { IoCopyOutline, IoShareOutline } from 'react-icons/io5';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, TextField, useDialogs } from '@/ui';

// Members see the code: it's what lets others in. Share (phones) or copy.
export function InviteCodeCard({ code, message }: { code: string; message: string }) {
  const { toast } = useDialogs();
  const canShare = typeof navigator.share === 'function';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Code copied');
    } catch {
      toast('Could not copy: select the code and copy it');
    }
  };
  return (
    <Card>
      <span className="muted">Invite code</span>
      <span className="code">{code}</span>
      <div className="row-sm wrap">
        <Button title="Copy code" icon={IoCopyOutline} size="sm" variant="secondary" onClick={() => void copy()} />
        {canShare ? (
          <Button title="Share" icon={IoShareOutline} size="sm" variant="secondary" onClick={() => void navigator.share({ text: message }).catch(() => undefined)} />
        ) : null}
      </div>
    </Card>
  );
}

// Owner only: invite a registered account by email (they can then vote /
// edit under "Invited only").
export function InviteByEmail({ path, onInvited }: { path: string; onInvited: () => void }) {
  const { authedApi } = useSession();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [done, setDone] = useState<string | null>(null);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setErrors(noErrors);
    setDone(null);
    try {
      const res = await authedApi<{ invited: { displayName: string } }>(path, { method: 'POST', body: { email: email.trim() } });
      setDone(`${res.invited.displayName} is invited.`);
      setEmail('');
      onInvited();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <form className="stack-sm" onSubmit={(e) => void invite(e)} noValidate>
        <TextField
          label="Invite by email"
          type="email"
          placeholder="friend@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.fields.email ?? errors.form ?? undefined}
          autoComplete="off"
        />
        {done ? <p className="success">{done}</p> : null}
        <Button type="submit" title="Invite" variant="secondary" loading={sending} disabled={!email.trim()} />
      </form>
    </Card>
  );
}

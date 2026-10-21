import { useState } from 'react';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { BrandHeader } from '@/layout/BrandHeader';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { Button, TextField } from '@/ui';
import { digitsOnly, RESEND_COOLDOWN_S, useCooldown } from './useCooldown';

export function VerifyEmailPage() {
  const { authedApi, signOut } = useSession();
  const { me, reload } = useCurrentUser();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useCooldown(0);

  const email = me.state === 'ok' ? me.user.email : 'your email';
  const canVerify = /^\d{6}$/.test(code) && !verifying;

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setVerifying(true);
    setErrors(noErrors);
    try {
      await authedApi('/auth/verify-email', { method: 'POST', body: { code } });
      // emailVerified is now true: the routes switch to the app.
      await reload();
    } catch (err) {
      setErrors(toFormErrors(err));
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setResendNotice(null);
    setErrors(noErrors);
    try {
      await authedApi('/auth/resend-verification', { method: 'POST' });
      setResendNotice(`New code sent to ${email}`);
      setCode('');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      // 429 says how long to wait ("Please wait 42s…"): show it as a countdown.
      const wait = err instanceof ApiError && err.status === 429 && /(\d+)s/.exec(err.message);
      if (wait) setCooldown(Number(wait[1]));
      else setErrors(toFormErrors(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void verify(e)} noValidate>
      <BrandHeader title="Check your email" />
      <p className="muted center">We sent a 6-digit code to {email}. It expires in 15 minutes.</p>
      <TextField
        label="Verification code"
        placeholder="123456"
        value={code}
        onChangeText={(t) => setCode(digitsOnly(t))}
        error={errors.fields.code}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
      />
      {errors.form ? <p className="error">{errors.form}</p> : null}
      {resendNotice ? <p className="muted">{resendNotice}</p> : null}
      <Button type="submit" title="Verify" loading={verifying} disabled={!canVerify} block />
      <Button title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'} variant="secondary" loading={resending} disabled={cooldown > 0} onClick={() => void resend()} block />
      <Button title="Log out" variant="secondary" onClick={() => void signOut()} block />
    </form>
  );
}

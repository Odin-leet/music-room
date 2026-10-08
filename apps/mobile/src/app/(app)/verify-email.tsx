import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';
import { BrandHeader } from '@/components/BrandHeader';

const RESEND_COOLDOWN_S = 60;

export default function VerifyEmailScreen() {
  const { authedApi, signOut } = useSession();
  const { me, reload } = useCurrentUser();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend countdown down to 0.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const email = me.state === 'ok' ? me.user.email : 'your email';
  const canVerify = /^\d{6}$/.test(code) && !verifying;

  const verify = async () => {
    if (!canVerify) return;
    setVerifying(true);
    setErrors(noErrors);
    try {
      await authedApi('/auth/verify-email', { method: 'POST', body: { code } });
      // emailVerified is now true: the (app) layout's guard switches to Home.
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
    <Screen centered form>
      <BrandHeader title="Check your email" />
      <Text variant="muted">We sent a 6-digit code to {email}. It expires in 15 minutes.</Text>

      <TextField
        label="Verification code"
        placeholder="123456"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        error={errors.fields.code}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={() => void verify()}
      />

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      {resendNotice ? <Text variant="muted">{resendNotice}</Text> : null}

      <Button
        title="Verify"
        loading={verifying}
        disabled={!canVerify}
        onPress={() => void verify()}
      />
      <Button
        title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        variant="secondary"
        loading={resending}
        disabled={cooldown > 0}
        onPress={() => void resend()}
      />
      <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

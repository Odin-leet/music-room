import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { Button, PageHeader, TextField } from '@/ui';
import { digitsOnly, RESEND_COOLDOWN_S, useCooldown } from './useCooldown';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  // The first code was just requested on the previous page.
  const [cooldown, setCooldown] = useCooldown(RESEND_COOLDOWN_S);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const canSubmit = /^\d{6}$/.test(code) && newPassword !== '' && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
      // Every session was ended by the reset: log in again with the new password.
      navigate(`/login?email=${encodeURIComponent(email)}&reset=1`, { replace: true });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResendNotice(null);
    setErrors(noErrors);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setResendNotice('If the account exists, a new code is on its way.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setErrors(toFormErrors(err));
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
      <PageHeader back="/forgot-password" title="Reset password" />
      <p className="muted">If {email} has an account, we sent it a 6-digit code. It expires in 15 minutes.</p>
      <TextField
        label="Reset code"
        placeholder="123456"
        value={code}
        onChangeText={(t) => setCode(digitsOnly(t))}
        error={errors.fields.code}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
      />
      <TextField label="New password" placeholder="At least 8 characters" value={newPassword} onChangeText={setNewPassword} error={errors.fields.newPassword} secure autoComplete="new-password" />
      {errors.form ? <p className="error">{errors.form}</p> : null}
      {resendNotice ? <p className="muted">{resendNotice}</p> : null}
      <Button type="submit" title="Reset password" loading={submitting} disabled={!canSubmit} block />
      <Button title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'} variant="secondary" disabled={cooldown > 0} onClick={() => void resend()} block />
    </form>
  );
}

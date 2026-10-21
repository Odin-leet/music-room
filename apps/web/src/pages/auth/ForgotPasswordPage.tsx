import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { Button, PageHeader, TextField } from '@/ui';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  // Prefilled when coming from the login page.
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const canSend = email.trim() !== '' && !sending;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setErrors(noErrors);
    try {
      // Always succeeds (204) for a well-formed email, account or not.
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void send(e)} noValidate>
      <PageHeader back="/login" title="Forgot password" />
      <p className="muted">Enter your account email. If it exists, we&apos;ll send a 6-digit code to reset your password.</p>
      <TextField label="Email" type="email" placeholder="you@example.com" value={email} onChangeText={setEmail} error={errors.fields.email} autoComplete="email" autoFocus />
      {errors.form ? <p className="error">{errors.form}</p> : null}
      <Button type="submit" title="Send code" loading={sending} disabled={!canSend} block />
      <div className="center">
        <Link className="link" to="/login">
          Back to log in
        </Link>
      </div>
    </form>
  );
}

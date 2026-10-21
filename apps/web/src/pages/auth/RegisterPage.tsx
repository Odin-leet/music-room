import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { BrandHeader } from '@/layout/BrandHeader';
import { useSession } from '@/session/SessionProvider';
import { Button, OrDivider, TextField } from '@/ui';
import type { AuthState } from './LoginPage';
import { SocialButtons } from './SocialButtons';

export function RegisterPage() {
  const { register } = useSession();
  const state = useLocation().state as AuthState;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  // Only "is it filled in" here — the API owns the real rules (email format,
  // 8–72 char password) and its messages are shown under each field.
  const canSubmit = displayName.trim() !== '' && email.trim() !== '' && password !== '' && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      // Creates the account, then logs in; the router then shows "Check your email".
      await register({ displayName: displayName.trim(), email: email.trim(), password });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
      <BrandHeader title="Create your account" subtitle="One account for every party and playlist." />
      <TextField label="Display name" placeholder="Alice" value={displayName} onChangeText={setDisplayName} error={errors.fields.displayName} autoComplete="name" autoFocus />
      <TextField label="Email" type="email" placeholder="you@example.com" value={email} onChangeText={setEmail} error={errors.fields.email} autoComplete="email" />
      <TextField label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} error={errors.fields.password} secure autoComplete="new-password" />

      {errors.form ? <p className="error">{errors.form}</p> : null}
      <Button type="submit" title="Create account" loading={submitting} disabled={!canSubmit} block />
      <OrDivider />
      <SocialButtons returnTo={state?.from ?? '/'} error={state?.socialError} />

      <div className="center">
        <Link className="link" to="/login" state={state}>
          Already have an account? Log in
        </Link>
      </div>
    </form>
  );
}

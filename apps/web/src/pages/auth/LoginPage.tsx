import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { getApiUrl } from '@/config';
import { BrandHeader } from '@/layout/BrandHeader';
import { useSession } from '@/session/SessionProvider';
import { Button, OrDivider, TextField } from '@/ui';
import { SocialButtons } from './SocialButtons';

export type AuthState = { from?: string; socialError?: string } | null;

export function LoginPage() {
  const { signIn } = useSession();
  const location = useLocation();
  const state = location.state as AuthState;
  // Set when arriving from a successful password reset.
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const canSubmit = email.trim() !== '' && password !== '' && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      // On success the session flips to signedIn and the router leaves this
      // page (to where you were going, if you followed a link).
      await signIn(email.trim(), password);
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
      <BrandHeader title="Welcome back" subtitle="Vote on the next track, build playlists together." />
      {params.get('reset') === '1' ? <p className="success">Password changed. Log in with your new password.</p> : null}

      <TextField
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.fields.email}
        autoComplete="email"
        autoFocus={!email}
      />
      <TextField
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        error={errors.fields.password}
        secure
        autoComplete="current-password"
        autoFocus={!!email}
      />

      {errors.form ? <p className="error">{errors.form}</p> : null}
      <Button type="submit" title="Log in" loading={submitting} disabled={!canSubmit} block />
      <OrDivider />
      <SocialButtons returnTo={state?.from ?? '/'} error={state?.socialError} />

      <div className="stack-sm center">
        <Link className="link" to={`/forgot-password?email=${encodeURIComponent(email.trim())}`}>
          Forgot password?
        </Link>
        <Link className="link" to="/register" state={state}>
          No account yet? Register
        </Link>
        {/* Point the app at another server before signing in (brief V.5). */}
        <Link className="link" to="/settings">
          Server: {getApiUrl() || 'not set'} · change
        </Link>
      </div>
    </form>
  );
}

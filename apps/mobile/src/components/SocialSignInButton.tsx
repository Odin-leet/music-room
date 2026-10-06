import { useState } from 'react';
import { ApiError } from '@/api/client';
import { SocialLoginError, useSession, type SocialProvider } from '@/session/SessionProvider';
import { Button, Text } from '@/ui';

const NAMES: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

function messageFor(err: unknown, name: string) {
  if (err instanceof SocialLoginError) {
    switch (err.code) {
      case 'account_exists':
        // Deliberately doesn't say *how* that account signs in (password or
        // Google): that would tell anyone with this email which method to attack.
        return 'This email already has a Music Room account. Sign in the way you created it — with your password or another provider.';
      case 'email_required':
        return `Your ${name} account has no email address. Add one on ${name}, or register with email.`;
      case 'access_denied':
        return `${name} sign-in was cancelled.`;
      default:
        return `${name} sign-in failed. Please try again.`;
    }
  }
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

// Used on both Log in and Register: the provider creates the account if needed.
export function SocialSignInButton({ provider }: { provider: SocialProvider }) {
  const { signInWithProvider } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = NAMES[provider];

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // On success the session flips to signedIn and the router leaves this
      // screen; `false` just means the user closed the browser.
      await signInWithProvider(provider);
    } catch (err) {
      setError(messageFor(err, name));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        title={`Continue with ${name}`}
        variant="secondary"
        loading={busy}
        onPress={() => void run()}
      />
      {error ? <Text variant="error">{error}</Text> : null}
    </>
  );
}

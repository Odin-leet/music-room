import { useState } from 'react';
import { ApiError } from '@/api/client';
import { SocialLoginError, useSession } from '@/session/SessionProvider';
import { Button, Text } from '@/ui';

// Messages for the error codes our API's callback can send back.
const MESSAGES: Record<string, string> = {
  account_exists:
    'This email already has a Music Room account. Log in with your password instead.',
  access_denied: 'Google sign-in was cancelled.',
};

function messageFor(err: unknown) {
  if (err instanceof SocialLoginError) {
    return MESSAGES[err.code] ?? 'Google sign-in failed. Please try again.';
  }
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

// Used on both Log in and Register: Google creates the account if needed.
export function GoogleSignInButton() {
  const { signInWithGoogle } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // On success the session flips to signedIn and the router leaves this
      // screen; `false` just means the user closed the browser.
      await signInWithGoogle();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        title="Continue with Google"
        variant="secondary"
        loading={busy}
        onPress={() => void run()}
      />
      {error ? <Text variant="error">{error}</Text> : null}
    </>
  );
}

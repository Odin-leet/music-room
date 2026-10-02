import { Link } from 'expo-router';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';

// TEMPORARY (step 9b): real login with fixed test credentials.
// Step 9c replaces this with the actual form.
const TEST_EMAIL = 'alice@example.com';
const TEST_PASSWORD = 'correct-horse';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logInAsTestUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(TEST_EMAIL, TEST_PASSWORD);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <Screen centered>
      <Text variant="title">Log in</Text>
      <TextField label="Email" placeholder="you@example.com" editable={false} />
      <TextField label="Password" placeholder="••••••••" secure editable={false} />
      {error ? <Text variant="error">{error}</Text> : null}
      <Button title="Log in as Alice (test, step 9b)" loading={loading} onPress={logInAsTestUser} />
      <Link href="/register">
        <Text variant="muted">No account yet? Register</Text>
      </Link>
    </Screen>
  );
}

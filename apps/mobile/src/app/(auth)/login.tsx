import { Link } from 'expo-router';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';

// Placeholder: real form state + POST /auth/login arrive in step 9.
export default function LoginScreen() {
  const { signIn } = useSession();

  return (
    <Screen centered>
      <Text variant="title">Log in</Text>
      <TextField label="Email" placeholder="you@example.com" editable={false} />
      <TextField label="Password" placeholder="••••••••" secure editable={false} />
      <Button title="Fake log in (step 8)" onPress={signIn} />
      <Link href="/register">
        <Text variant="muted">No account yet? Register</Text>
      </Link>
    </Screen>
  );
}

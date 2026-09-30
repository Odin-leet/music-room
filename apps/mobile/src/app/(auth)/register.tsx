import { Link } from 'expo-router';
import { Screen, Text, TextField } from '@/ui';

// Placeholder: real form state + POST /auth/register arrive in step 9.
export default function RegisterScreen() {
  return (
    <Screen centered>
      <Text variant="title">Create account</Text>
      <TextField label="Display name" placeholder="Alice" editable={false} />
      <TextField label="Email" placeholder="you@example.com" editable={false} />
      <TextField label="Password" placeholder="At least 8 characters" secure editable={false} />
      <Link href="/login">
        <Text variant="muted">Already have an account? Log in</Text>
      </Link>
    </Screen>
  );
}

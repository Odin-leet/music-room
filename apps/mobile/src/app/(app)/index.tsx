import { API_URL } from '@/config';
import { ClientChecks } from '@/dev/ClientChecks';
import { useHealth } from '@/hooks/useHealth';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, Text } from '@/ui';

// Home. For now: the API health check and a fake log out; real profile data
// from GET /users/me arrives in step 9.
export default function HomeScreen() {
  const { signOut } = useSession();
  const { health, check } = useHealth();

  return (
    <Screen centered>
      <Text variant="title">Music Room</Text>

      <Card>
        <Text variant="muted">{API_URL}</Text>
        {health.state === 'loading' && <Text>Checking API…</Text>}
        {health.state === 'ok' && <Text variant="success">API: {health.data.status}</Text>}
        {health.state === 'error' && (
          <Text variant="error">API unreachable: {health.message}</Text>
        )}
      </Card>

      <Button
        title="Check again"
        loading={health.state === 'loading'}
        onPress={() => void check()}
      />
      <Button title="Fake log out (step 8)" variant="secondary" onPress={signOut} />
      <ClientChecks />
    </Screen>
  );
}

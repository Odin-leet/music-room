import { useState } from 'react';
import { API_URL } from '@/config';
import { useHealth } from '@/hooks/useHealth';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, Text } from '@/ui';

// Home. Step 9d replaces the token line with your profile from GET /users/me.
export default function HomeScreen() {
  const { accessToken, signOut } = useSession();
  const { health, check } = useHealth();
  const [signingOut, setSigningOut] = useState(false);

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
        <Text variant="muted">
          Access token (in memory): {accessToken ? `${accessToken.slice(0, 16)}…` : 'none'}
        </Text>
      </Card>

      <Button
        title="Check again"
        loading={health.state === 'loading'}
        onPress={() => void check()}
      />
      <Button
        title="Log out"
        variant="secondary"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true);
          void signOut();
        }}
      />
    </Screen>
  );
}

import { useState } from 'react';
import { API_URL } from '@/config';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useHealth } from '@/hooks/useHealth';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, Text } from '@/ui';

export default function HomeScreen() {
  const { signOut } = useSession();
  const me = useCurrentUser();
  const { health, check } = useHealth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen centered>
      {me.state === 'loading' && <Text variant="muted">Loading your profile…</Text>}
      {me.state === 'ok' && (
        <>
          <Text variant="title">Hi, {me.user.displayName}</Text>
          <Text variant="muted">{me.user.email}</Text>
        </>
      )}
      {me.state === 'error' && <Text variant="error">{me.message}</Text>}

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
        variant="secondary"
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

import type { HealthResponse } from '@music-room/shared';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { API_URL } from '@/config';
import { Button, Card, Screen, Text, TextField } from '@/ui';

type Health =
  | { state: 'loading' }
  | { state: 'ok'; data: HealthResponse }
  | { state: 'error'; message: string };

// Temporary connectivity + UI-kit check (M1/M2). Replaced by expo-router in step 8.
export default function App() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });

  const check = useCallback(async () => {
    setHealth({ state: 'loading' });
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth({ state: 'ok', data: (await res.json()) as HealthResponse });
    } catch (err) {
      setHealth({
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <SafeAreaProvider>
      <Screen centered>
        <Text variant="title">Music Room</Text>

        <Card>
          <Text variant="muted">{API_URL}</Text>
          {health.state === 'loading' && <Text>Checking API…</Text>}
          {health.state === 'ok' && (
            <Text variant="success">API: {health.data.status}</Text>
          )}
          {health.state === 'error' && (
            <Text variant="error">API unreachable: {health.message}</Text>
          )}
        </Card>

        <Button
          title="Check again"
          loading={health.state === 'loading'}
          onPress={() => void check()}
        />

        {/* UI-kit preview: the error state forms will use for API 400/409s. */}
        <TextField
          label="Email (preview)"
          value="not-an-email"
          editable={false}
          error="email must be an email"
        />
        <Button title="Secondary button" variant="secondary" onPress={() => {}} />
      </Screen>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

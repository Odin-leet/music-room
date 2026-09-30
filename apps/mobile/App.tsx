import type { HealthResponse } from '@music-room/shared';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { API_URL } from './src/config';

type Health =
  | { state: 'loading' }
  | { state: 'ok'; data: HealthResponse }
  | { state: 'error'; message: string };

// Temporary connectivity check (M1). Replaced by the real navigation in M2.
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
    <View style={styles.container}>
      <Text style={styles.url}>{API_URL}</Text>
      {health.state === 'loading' && <Text>Checking API…</Text>}
      {health.state === 'ok' && (
        <Text style={styles.ok}>API: {health.data.status}</Text>
      )}
      {health.state === 'error' && (
        <Text style={styles.error}>API unreachable: {health.message}</Text>
      )}
      <Button title="Check again" onPress={() => void check()} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  url: { color: '#666' },
  ok: { fontSize: 24, color: 'green' },
  error: { fontSize: 16, color: 'crimson', textAlign: 'center', padding: 16 },
});

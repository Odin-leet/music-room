import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { builtInApiUrl, getApiUrl, normalizeApiUrl, saveApiUrl } from '@/config';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, Text, TextField } from '@/ui';

const TEST_TIMEOUT_MS = 5_000;

// Which Music Room server the app talks to (brief V.5: a runtime setting,
// so an evaluator can point the app at their own instance). Reachable from
// the login screen and from Home: outside both route groups.
export default function ServerSettingsScreen() {
  const { status, signOut } = useSession();
  const [value, setValue] = useState(getApiUrl());
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = normalizeApiUrl(value);
  const changed = url !== null && url !== getApiUrl();

  const runTest = async () => {
    if (!url) return;
    setTesting(true);
    setTest(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      const body = (await res.json().catch(() => null)) as { status?: string } | null;
      setTest(
        res.ok && body?.status === 'ok'
          ? { ok: true, message: 'Music Room server reachable.' }
          : { ok: false, message: `Something answered, but not a Music Room server (HTTP ${res.status}).` },
      );
    } catch {
      setTest({ ok: false, message: 'No answer from this address.' });
    } finally {
      clearTimeout(timer);
      setTesting(false);
    }
  };

  // Tokens belong to one server: switching while signed in signs out first.
  const apply = async (next: string | null) => {
    setSaving(true);
    setError(null);
    try {
      if (status === 'signedIn') await signOut();
      await saveApiUrl(next);
      router.back();
    } catch {
      setError('Could not save the address.');
      setSaving(false);
    }
  };

  const confirm = (next: string | null) => {
    if (status !== 'signedIn') return void apply(next);
    Alert.alert('Change server?', 'You will be signed out: your account lives on the current server.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change and sign out', style: 'destructive', onPress: () => void apply(next) },
    ]);
  };

  return (
    <Screen form>
      <Text variant="title">Server settings</Text>
      <Text variant="muted">Now using: {getApiUrl() || 'no address set'}</Text>

      <TextField
        label="Server address"
        placeholder="http://192.168.1.10:3000"
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setTest(null);
        }}
        error={value.trim() && !url ? 'An address like http://192.168.1.10:3000' : undefined}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Test connection" variant="secondary" loading={testing} disabled={!url} onPress={() => void runTest()} />
      {test ? <Text variant={test.ok ? 'success' : 'error'}>{test.message}</Text> : null}

      <Card>
        <Text variant="muted">Which address?</Text>
        <Text variant="muted">• Android emulator, server on this computer: http://10.0.2.2:3000</Text>
        <Text variant="muted">• iOS simulator: http://localhost:3000</Text>
        <Text variant="muted">{'• A phone on the same Wi-Fi: http://<the computer’s IP>:3000'}</Text>
      </Card>

      {error ? <Text variant="error">{error}</Text> : null}
      <Button title="Save" loading={saving} disabled={!changed} onPress={() => confirm(url)} />
      {builtInApiUrl && getApiUrl() !== builtInApiUrl ? (
        <Button
          title={`Use the default (${builtInApiUrl})`}
          variant="secondary"
          disabled={saving}
          onPress={() => confirm(null)}
        />
      ) : null}
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

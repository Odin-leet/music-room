// TEMPORARY (SG2 experiment): proves app -> API -> Google -> API -> app works
// in Expo Go before we build the real flow. Deleted in SG4.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { API_URL } from '@/config';
import { Button, Card, Text } from '@/ui';

export function GoogleRoundTrip() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    // Expo Go: exp://10.0.2.2:8081/--/oauth · own build: musicroom://oauth
    const returnUrl = Linking.createURL('oauth');
    const startUrl = `${API_URL}/auth/google/start?redirect=${encodeURIComponent(returnUrl)}`;
    const res = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
    if (res.type === 'success') {
      const { queryParams } = Linking.parse(res.url);
      setResult(`success\nreturnUrl: ${returnUrl}\nparams: ${JSON.stringify(queryParams)}`);
    } else {
      setResult(`${res.type}\nreturnUrl: ${returnUrl}`);
    }
    setBusy(false);
  };

  return (
    <Card>
      <Button title="Continue with Google (SG2 test)" variant="secondary" loading={busy} onPress={() => void run()} />
      {result ? <Text variant="muted">{result}</Text> : null}
    </Card>
  );
}

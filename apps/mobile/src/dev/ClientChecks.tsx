// TEMPORARY (step 9a): exercises api() and tokenStore against the real API.
// Deleted in step 9b.
import type { HealthResponse } from '@music-room/shared';
import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { tokenStore } from '@/session/tokenStore';
import { Button, Card, Text } from '@/ui';

type Result = { name: string; ok: boolean; detail: string };

const describe = (err: unknown) =>
  err instanceof ApiError
    ? `ApiError ${err.status}: ${err.message}${
        Object.keys(err.fieldErrors).length ? ` | fields: ${Object.keys(err.fieldErrors).join(', ')}` : ''
      }`
    : String(err);

async function runChecks(): Promise<Result[]> {
  const results: Result[] = [];
  const check = async (name: string, fn: () => Promise<string>) => {
    try {
      results.push({ name, ok: true, detail: await fn() });
    } catch (err) {
      results.push({ name, ok: false, detail: describe(err) });
    }
  };
  // Expect an ApiError with a given status; anything else is a failure.
  const expectError = (status: number, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === status) return describe(err);
      throw err;
    }
    throw new Error(`expected HTTP ${status}, got success`);
  };

  await check('GET /health', async () => (await api<HealthResponse>('/health')).status);
  await check(
    'login, wrong password -> 401',
    expectError(401, () =>
      api('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'nope-nope' } }),
    ),
  );
  await check(
    'register {} -> 400 + fieldErrors',
    expectError(400, () => api('/auth/register', { method: 'POST', body: {} })),
  );
  await check(
    '/users/me without token -> 401',
    expectError(401, () => api('/users/me')),
  );
  await check('secure-store round trip', async () => {
    await tokenStore.setRefreshToken('test-token-123');
    const read = await tokenStore.getRefreshToken();
    await tokenStore.clear();
    const afterClear = await tokenStore.getRefreshToken();
    if (read !== 'test-token-123' || afterClear !== null) {
      throw new Error(`read=${read} afterClear=${afterClear}`);
    }
    return 'set -> get -> clear OK';
  });
  return results;
}

export function ClientChecks() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);

  return (
    <Card>
      <Button
        title="Run 9a checks"
        variant="secondary"
        loading={running}
        onPress={async () => {
          setRunning(true);
          setResults(await runChecks());
          setRunning(false);
        }}
      />
      {results?.map((r) => (
        <Text key={r.name} variant={r.ok ? 'body' : 'error'}>
          {r.ok ? '✅' : '❌'} {r.name}: {r.detail}
        </Text>
      ))}
    </Card>
  );
}

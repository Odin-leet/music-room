import { useState } from 'react';
import { useNavigate } from 'react-router';
import { builtInApiUrl, getApiUrl, normalizeApiUrl, saveApiUrl } from '@/config';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, PageHeader, TextField, useDialogs } from '@/ui';

const TEST_TIMEOUT_MS = 5_000;

// Which HOLY server this web app talks to (brief V.5: a runtime setting, so
// an evaluator can point it at their own instance). Saved in this browser.
// That server must list this page's origin in its WEB_ORIGINS (CORS).
export function SettingsPage() {
  const { status, signOut } = useSession();
  const { confirm } = useDialogs();
  const navigate = useNavigate();
  const [value, setValue] = useState(getApiUrl());
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

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
          ? { ok: true, message: 'HOLY server reachable.' }
          : { ok: false, message: `Something answered, but not a HOLY server (HTTP ${res.status}).` },
      );
    } catch {
      setTest({ ok: false, message: `No answer — or that server doesn't allow this page (${window.location.origin}) in its WEB_ORIGINS.` });
    } finally {
      clearTimeout(timer);
      setTesting(false);
    }
  };

  // Tokens belong to one server: switching while signed in signs out first.
  const apply = async (next: string | null) => {
    if (
      status === 'signedIn' &&
      !(await confirm({ title: 'Change server?', message: 'You will be signed out: your account lives on the current server.', confirm: 'Change and sign out', destructive: true }))
    ) {
      return;
    }
    setSaving(true);
    if (status === 'signedIn') await signOut();
    saveApiUrl(next);
    // A full reload: every socket and request starts over on the new server.
    window.location.assign('/');
  };

  const body = (
    <div className="stack">
      <PageHeader back={status === 'signedIn' ? '/profile' : '/login'} title="Server settings" />
      <p className="muted">Now using: {getApiUrl() || 'no address set'}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) void apply(url);
        }}
        noValidate
      >
        <TextField
          label="Server address"
          placeholder="http://localhost:3000"
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setTest(null);
          }}
          error={value.trim() && !url ? 'An address like http://192.168.1.10:3000' : undefined}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        <Button title="Test connection" variant="secondary" loading={testing} disabled={!url} onClick={() => void runTest()} block />
        {test ? <p className={test.ok ? 'success' : 'error'}>{test.message}</p> : null}

        <Card>
          <p className="muted">Which address?</p>
          <p className="muted">• The API on this computer: http://localhost:3000</p>
          <p className="muted">{'• On the same Wi-Fi: http://<the computer’s IP>:3000'}</p>
          <p className="muted">The server must allow this page ({window.location.origin}) in WEB_ORIGINS.</p>
        </Card>

        <Button type="submit" title="Save" loading={saving} disabled={!changed} block />
        {getApiUrl() !== builtInApiUrl ? (
          <Button title={`Use the default (${builtInApiUrl})`} variant="secondary" disabled={saving} onClick={() => void apply(null)} block />
        ) : null}
      </form>
      {status !== 'signedIn' ? (
        <div className="center">
          <button type="button" className="link" onClick={() => navigate('/login')}>
            Back to log in
          </button>
        </div>
      ) : null}
    </div>
  );

  return status === 'signedIn' ? <div className="page narrow">{body}</div> : body;
}

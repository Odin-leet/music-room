// Who is calling, as the app tells us (brief V.6: every action logged with
// platform, device model and app version). Sent by the app as headers on
// REST calls and in the socket handshake's `auth.client`.
// Untrusted input: only used for logging, never for decisions. Trimmed and
// stripped of control characters so it can't break or forge log lines.
export type ClientInfo = { platform: string; device: string; version: string };

const clean = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'unknown';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'unknown';
};

export function clientFromHeaders(headers: Record<string, string | string[] | undefined>): ClientInfo {
  const one = (name: string) => {
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    platform: clean(one('x-client-platform')),
    device: clean(one('x-client-device')),
    version: clean(one('x-client-version')),
  };
}

export function clientFromHandshake(auth: unknown): ClientInfo {
  const c = (auth as { client?: Record<string, unknown> } | undefined)?.client ?? {};
  return { platform: clean(c.platform), device: clean(c.device), version: clean(c.version) };
}

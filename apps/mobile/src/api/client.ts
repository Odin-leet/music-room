import { API_URL } from '@/config';

const TIMEOUT_MS = 10_000;

// Every failed call becomes one of these, so screens handle a single shape:
// - status 0       -> network problem / timeout (no response at all)
// - fieldErrors    -> per-field messages from a Nest ValidationPipe 400,
//                     e.g. { email: 'email must be an email' }
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  // Access token for routes behind JwtAuthGuard.
  token?: string | null;
};

export async function api<T>(path: string, { method = 'GET', body, token }: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    throw new ApiError(0, timedOut ? 'The server took too long to respond' : "Can't reach the server");
  } finally {
    clearTimeout(timer);
  }

  // 204 No Content (e.g. /auth/logout) has no body to parse.
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, data);
  return data as T;
}

// Nest error bodies look like { statusCode, error, message }, where message is
// a string, or an array of strings for ValidationPipe 400s.
function toApiError(status: number, data: unknown): ApiError {
  const raw = (data as { message?: unknown } | null)?.message;
  const messages = Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === 'string')
    : typeof raw === 'string'
      ? [raw]
      : [];

  // class-validator messages start with the property name
  // ("password must be longer than…"), so the first word is the field.
  // Keep the first message per field.
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const message of messages) {
      const field = message.split(' ')[0];
      fieldErrors[field] ??= message;
    }
  }

  return new ApiError(status, messages[0] ?? `Request failed (HTTP ${status})`, fieldErrors);
}

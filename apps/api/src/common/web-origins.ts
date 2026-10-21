// The web app's addresses (apps/web), from WEB_ORIGINS: comma-separated
// origins like "http://localhost:5173,https://holy.example.com". Unset = the
// Vite dev server. Used for two things only:
//   - CORS: which pages may call the REST API from a browser;
//   - social login: the web app's /oauth page is an allowed place to send
//     the browser back to (next to the mobile app's deep links).
// Exact origins (scheme + host + port), never patterns: a look-alike host
// must not get a login code sent to it.
const DEFAULT_WEB_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function parseWebOrigins(raw: string | undefined): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => {
      try {
        const url = new URL(o);
        // Only a bare origin: no path, query or credentials.
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === o;
      } catch {
        return false;
      }
    });
  return list.length ? list : DEFAULT_WEB_ORIGINS;
}

export const webOrigins = () => parseWebOrigins(process.env.WEB_ORIGINS);

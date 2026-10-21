// Where the API may send the browser back to after a social login. No Nest
// imports, so the rule can be unit-tested (app-redirect.spec.ts).
//   exp://…          Expo Go in development
//   musicroom://…    our own builds (app.json scheme)
//   <web origin>/oauth   the web app (apps/web), for an origin in WEB_ORIGINS
// Anything else is refused, so a crafted link can't redirect a login
// elsewhere. (The login code is also bound to the PKCE verifier, which only
// the app that started the login holds: a leaked code is useless anyway.)
const APP_DEEP_LINKS = [/^exp:\/\//, /^musicroom:\/\//];

export function isAllowedAppRedirect(redirect: string | undefined, webOrigins: string[]): boolean {
  if (!redirect) return false;
  if (APP_DEEP_LINKS.some((re) => re.test(redirect))) return true;
  try {
    const url = new URL(redirect);
    // The exact page, with nothing that could change where it lands.
    return webOrigins.includes(url.origin) && url.pathname === '/oauth' && !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}

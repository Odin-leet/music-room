import { isAllowedAppRedirect } from './app-redirect';
import { parseWebOrigins } from '../common/web-origins';

const WEB = ['http://localhost:5173', 'https://holy.example.com'];

describe('isAllowedAppRedirect (where a social login may send the browser back)', () => {
  it('accepts the mobile app deep links', () => {
    expect(isAllowedAppRedirect('exp://192.168.1.10:8081/--/oauth', WEB)).toBe(true);
    expect(isAllowedAppRedirect('musicroom://oauth', WEB)).toBe(true);
  });

  it("accepts the web app's /oauth page on a configured origin", () => {
    expect(isAllowedAppRedirect('http://localhost:5173/oauth', WEB)).toBe(true);
    expect(isAllowedAppRedirect('https://holy.example.com/oauth', WEB)).toBe(true);
  });

  it('refuses other origins, look-alikes and other schemes', () => {
    expect(isAllowedAppRedirect('https://evil.example.com/oauth', WEB)).toBe(false);
    expect(isAllowedAppRedirect('https://holy.example.com.evil.com/oauth', WEB)).toBe(false);
    expect(isAllowedAppRedirect('http://holy.example.com/oauth', WEB)).toBe(false); // http, not https
    expect(isAllowedAppRedirect('http://localhost:5174/oauth', WEB)).toBe(false); // other port
    expect(isAllowedAppRedirect('javascript:alert(1)', WEB)).toBe(false);
    expect(isAllowedAppRedirect(undefined, WEB)).toBe(false);
  });

  it('refuses another page, a query, a fragment or credentials on an allowed origin', () => {
    expect(isAllowedAppRedirect('http://localhost:5173/', WEB)).toBe(false);
    expect(isAllowedAppRedirect('http://localhost:5173/oauth/x', WEB)).toBe(false);
    expect(isAllowedAppRedirect('http://localhost:5173/oauth?next=https://evil.com', WEB)).toBe(false);
    expect(isAllowedAppRedirect('http://localhost:5173/oauth#x', WEB)).toBe(false);
    expect(isAllowedAppRedirect('http://user:pw@localhost:5173/oauth', WEB)).toBe(false);
  });
});

describe('parseWebOrigins (WEB_ORIGINS)', () => {
  it('reads a comma-separated list and drops trailing slashes', () => {
    expect(parseWebOrigins(' http://localhost:5173/ , https://holy.example.com')).toEqual(WEB);
  });

  it('ignores anything that is not a bare http(s) origin', () => {
    expect(parseWebOrigins('https://holy.example.com/app,ftp://x.com,*,https://ok.example.com')).toEqual(['https://ok.example.com']);
  });

  it('falls back to the Vite dev server when unset or empty', () => {
    expect(parseWebOrigins(undefined)).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    expect(parseWebOrigins('*')).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });
});

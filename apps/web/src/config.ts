import { storage } from '@/lib/storage';

// The API's address is a runtime setting (brief V.5), like in the mobile app:
//   1. an address saved in this browser in Server settings, if any;
//   2. otherwise the one built in from VITE_API_URL (apps/web/.env);
//   3. otherwise the API on this computer.
// Read it with getApiUrl() at call time, never copy it into a constant.
const BUILT_IN = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '');
const KEY = 'holy.apiUrl';

// "http(s)://host[:port][/path]", no trailing slash — or null if not one.
export function normalizeApiUrl(input: string): string | null {
  const url = input.trim().replace(/\/+$/, '');
  return /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[^\s?#]*)?$/i.test(url) ? url : null;
}

const saved = storage.get(KEY);
let current = saved && normalizeApiUrl(saved) ? saved : BUILT_IN;

export const getApiUrl = () => current;
export const builtInApiUrl = BUILT_IN;

// null = forget the saved address and use the built-in one.
export function saveApiUrl(url: string | null) {
  if (url === null || url === BUILT_IN) {
    storage.remove(KEY);
    current = BUILT_IN;
  } else {
    storage.set(KEY, url);
    current = url;
  }
}

import * as SecureStore from 'expo-secure-store';

// The API's address is a runtime setting (brief V.5: "the server's base URL
// must be a runtime setting … so evaluators can point the app at their own
// instance"):
//   1. an address saved on this phone in Server settings, if any;
//   2. otherwise the one built into the app from EXPO_PUBLIC_API_URL.
// Read it with getApiUrl() at call time, never copy it into a constant.

// Expo inlines EXPO_PUBLIC_* at bundle time, so this must be accessed as a
// literal `process.env.EXPO_PUBLIC_API_URL` (no destructuring or dynamic keys).
const BUILT_IN = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const KEY = 'musicroom.apiUrl';

let current = BUILT_IN;

export const getApiUrl = () => current;
export const builtInApiUrl = BUILT_IN;

// "http(s)://host[:port][/path]", no trailing slash — or null if not one.
export function normalizeApiUrl(input: string): string | null {
  const url = input.trim().replace(/\/+$/, '');
  return /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[^\s?#]*)?$/i.test(url) ? url : null;
}

// Once, at startup, before anything talks to the server.
export async function loadApiUrl() {
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (saved && normalizeApiUrl(saved)) current = saved;
}

// null = forget the saved address and use the built-in one.
export async function saveApiUrl(url: string | null) {
  if (url === null || url === BUILT_IN) {
    await SecureStore.deleteItemAsync(KEY);
    current = BUILT_IN;
  } else {
    await SecureStore.setItemAsync(KEY, url);
    current = url;
  }
}

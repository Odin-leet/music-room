// Expo inlines EXPO_PUBLIC_* at bundle time, so this must be accessed as a
// literal `process.env.EXPO_PUBLIC_API_URL` (no destructuring or dynamic keys).
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env, then restart Expo.',
  );
}

// Strip a trailing slash so `${API_URL}/health` never becomes `//health`.
export const API_URL = apiUrl.replace(/\/+$/, '');

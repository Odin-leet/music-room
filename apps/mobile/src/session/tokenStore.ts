import * as SecureStore from 'expo-secure-store';

// Only the refresh token is persisted — in the OS keychain (iOS) / Keystore-
// encrypted storage (Android). The access token lives in memory only: it's
// short-lived, and a fresh one comes from /auth/refresh on the next launch.
// Keys may only contain letters, digits, ".", "-" and "_".
const REFRESH_TOKEN_KEY = 'musicroom.refreshToken';

export const tokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};

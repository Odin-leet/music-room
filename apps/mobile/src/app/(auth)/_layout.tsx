import { Stack } from 'expo-router';

// Logged-out screens. Order matters: login is the first screen shown.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}

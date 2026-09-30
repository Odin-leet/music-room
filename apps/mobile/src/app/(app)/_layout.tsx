import { Stack } from 'expo-router';

// Logged-in screens.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

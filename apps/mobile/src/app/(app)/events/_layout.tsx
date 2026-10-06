import { Stack } from 'expo-router';

// Track Vote screens. The whole folder is one entry in the (app) layout's
// "verified email" guard, so every screen added here is protected too.
export default function EventsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Stack } from 'expo-router';

// Profile and people screens. One entry in the (app) layout's "verified
// email" guard, so every screen added here is protected too.
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

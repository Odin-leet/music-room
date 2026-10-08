import { Stack } from 'expo-router';

// People search, profiles and friends. One entry in the (app) layout's
// "verified email" guard, so every screen added here is protected too.
export default function PeopleLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

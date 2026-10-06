import { Stack } from 'expo-router';

// Playlist Editor screens. The whole folder is one entry in the (app)
// layout's "verified email" guard, so every screen added here is protected too.
export default function PlaylistsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

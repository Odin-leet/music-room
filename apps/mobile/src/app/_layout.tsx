import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '@/session/SessionProvider';

// Keep the native splash up until we know whether a saved session restores,
// so the login screen never flashes before Home. Module scope, per the docs.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // Gestures (drag to reorder a playlist) need this root around the whole app.
    <GestureHandlerRootView style={styles.root}>
      <SessionProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

// Exactly one group is reachable at a time. When the status flips, the router
// moves to the first screen that's now allowed and drops the other group's
// history, so "back" can't return to a screen you no longer have access to.
function RootNavigator() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'restoring') SplashScreen.hide();
  }, [status]);

  if (status === 'restoring') return null;

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Social-login return link: reachable in both states, closes itself. */}
      <Stack.Screen name="oauth" options={{ animation: 'none' }} />
      {/* Which server to talk to: reachable signed in or not (brief V.5). */}
      <Stack.Screen name="settings" />
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

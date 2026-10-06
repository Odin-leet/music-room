import { Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { CurrentUserProvider, useCurrentUser } from '@/session/CurrentUserProvider';
import { useSession } from '@/session/SessionProvider';
import { colors } from '@/theme';
import { Button, Screen, Text } from '@/ui';

// Logged-in screens. Until the email is verified, the only reachable screen
// is verify-email; once it is, everything else opens and verify-email closes.
export default function AppLayout() {
  return (
    <CurrentUserProvider>
      <AppNavigator />
    </CurrentUserProvider>
  );
}

function AppNavigator() {
  const { me, reload } = useCurrentUser();
  const { signOut } = useSession();

  if (me.state === 'loading') {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (me.state === 'error') {
    return (
      <Screen centered>
        <Text variant="error">{me.message}</Text>
        <Button title="Try again" onPress={() => void reload()} />
        <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
      </Screen>
    );
  }

  const verified = me.user.emailVerified;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={verified}>
        <Stack.Screen name="index" />
        {/* TEMPORARY: music provider experiment */}
        <Stack.Screen name="music-test" />
      </Stack.Protected>
      <Stack.Protected guard={!verified}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
    </Stack>
  );
}

import { Tabs } from 'expo-router';
import { AppTabBar, type TabMeta } from '@/player/AppTabBar';
import { useIncomingRequests } from '@/profile/MeRealtimeProvider';

// The signed-in app: 5 tabs, each with its own stack of screens, and the
// mini-player above the tab bar (AppTabBar) on every one of them.
export default function TabsLayout() {
  const incomingRequests = useIncomingRequests();
  const meta: Record<string, TabMeta> = {
    index: { title: 'Home', icon: 'home' },
    events: { title: 'Events', icon: 'people-circle' },
    playlists: { title: 'Playlists', icon: 'musical-notes' },
    people: { title: 'Friends', icon: 'heart', badge: incomingRequests },
    profile: { title: 'Profile', icon: 'person-circle' },
  };
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} meta={meta} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="playlists" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

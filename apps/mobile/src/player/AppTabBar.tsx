import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '@/theme';
import { Text } from '@/ui';
import { MiniPlayer } from './MiniPlayer';

// The props expo-router's Tabs gives a custom tabBar.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabMeta = { title: string; icon: ComponentProps<typeof Ionicons>['name']; badge?: number };

// Our own tab bar (expo-router keeps its default one private): the
// mini-player sits right on top of it, on every tab.
export function AppTabBar({ state, navigation, meta }: TabBarProps & { meta: Record<string, TabMeta> }) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <MiniPlayer />
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const m = meta[route.name];
          if (!m) return null;
          const focused = state.index === index;
          const color = focused ? colors.text : colors.textMuted;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            // Pressing the tab you're on goes back to its first screen (the stack handles tabPress).
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={m.badge ? `${m.title}, ${m.badge} new` : m.title}
            >
              <View>
                <Ionicons name={focused ? m.icon : (`${m.icon}-outline` as TabMeta['icon'])} size={24} color={color} />
                {m.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{m.badge > 9 ? '9+' : m.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color }]}>{m.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 11, fontWeight: font.weight.medium },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: font.weight.bold },
});

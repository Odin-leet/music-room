import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  // Center content vertically (e.g. auth forms, status screens).
  centered?: boolean;
  style?: ViewStyle;
};

// Outer container for every screen: background, page padding, and keeps
// content out from under the status bar / notch / gesture bar.
export function Screen({ children, centered = false, style }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.content, centered && styles.centered, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  centered: { justifyContent: 'center' },
});

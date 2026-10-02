import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  // Center content vertically (e.g. auth forms, status screens).
  centered?: boolean;
  // For forms: scrolls, and moves content up so the keyboard doesn't cover it.
  form?: boolean;
  style?: ViewStyle;
};

// Outer container for every screen: background, page padding, and keeps
// content out from under the status bar / notch / gesture bar.
export function Screen({ children, centered = false, form = false, style }: Props) {
  const contentStyle = [styles.content, centered && styles.centered, style];

  return (
    <SafeAreaView style={styles.safe}>
      {form ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[styles.grow, ...contentStyle]}
            // Taps on buttons work while the keyboard is open.
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, ...contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  centered: { justifyContent: 'center' },
});

import { Image, StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from '@/ui';

// The HOLY wordmark (assets/brand/wordmark.png, recoloured light for the
// dark screens by make-icons.py), then what this screen does.
const WORDMARK = require('../../assets/wordmark-light.png') as number;
const RATIO = 226 / 849; // the image's height / width

export function BrandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" accessibilityRole="image" accessibilityLabel="HOLY" />
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="muted" style={styles.center}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  wordmark: { width: 200, height: 200 * RATIO, marginBottom: spacing.lg },
  center: { textAlign: 'center' },
});

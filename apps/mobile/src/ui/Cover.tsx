import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import type { IconName } from './Button';

type Props = {
  // One cover, or up to 4 (a 2x2 mosaic, like a playlist's first tracks).
  uri?: string | null;
  uris?: (string | null)[];
  size: number;
  // Shown when there's no image.
  icon?: IconName;
  rounded?: boolean;
};

// Album art, or a calm placeholder with an icon.
export function Cover({ uri, uris, size, icon = 'musical-note', rounded = false }: Props) {
  const box = { width: size, height: size, borderRadius: rounded ? size / 2 : size > 80 ? radius.lg : radius.sm };
  const images = (uris ?? (uri ? [uri] : [])).filter((u): u is string => !!u);

  if (images.length >= 4) {
    const half = size / 2;
    return (
      <View style={[styles.mosaic, box]}>
        {images.slice(0, 4).map((u, i) => (
          <Image key={`${u}-${i}`} source={{ uri: u }} style={{ width: half, height: half }} />
        ))}
      </View>
    );
  }
  if (images.length) return <Image source={{ uri: images[0] }} style={[styles.image, box]} accessibilityIgnoresInvertColors />;
  return (
    <View style={[styles.placeholder, box]}>
      <Ionicons name={icon} size={size * 0.42} color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceRaised },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  placeholder: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});

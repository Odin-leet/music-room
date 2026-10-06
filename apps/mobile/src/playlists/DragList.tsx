import { useLayoutEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, spacing } from '@/theme';
import { Text } from '@/ui';

// Every row has the same height, so "where would it land" is plain
// arithmetic: no measuring.
export const ROW_HEIGHT = 64;
const GAP = spacing.sm;
const STEP = ROW_HEIGHT + GAP;

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  // Dragging is offered only when true (e.g. you may edit the playlist).
  enabled: boolean;
  // A row was dropped at a new index.
  onMove: (from: number, to: number) => void;
  empty?: ReactNode;
};

// Where the dragged row would land, from how far it has been moved.
function targetIndex(from: number, dy: number, count: number) {
  'worklet';
  return Math.min(count - 1, Math.max(0, Math.round(from + dy / STEP)));
}

// A list you reorder by dragging a row's ≡ handle. Our own small version
// on top of gesture-handler + Reanimated (react-native-draggable-flatlist
// didn't work on React Native 0.86 / Reanimated 4).
// - The handle's pan gesture moves the row with the finger, on the UI thread.
// - The rows it passes over slide out of the way, showing where it will land.
// - On release, onMove(from, to) is called once; the parent reorders its data.
export function DragList<T>({ items, keyOf, renderRow, enabled, onMove, empty }: Props<T>) {
  const active = useSharedValue(-1); // index being dragged, -1 = none
  const dy = useSharedValue(0); // how far it has moved, in px
  const [dragging, setDragging] = useState(false);

  // Clear the offsets when the new order is drawn, not before (or the
  // dropped row would flash back to its old place). Dropping ends the drag
  // and reorders the data in the same render. Not while a drag is going on,
  // so someone else's live change doesn't cancel it.
  const order = items.map(keyOf).join(',');
  useLayoutEffect(() => {
    if (dragging) return;
    active.value = -1;
    dy.value = 0;
  }, [order, dragging, active, dy]);

  const drop = (from: number, to: number) => {
    setDragging(false);
    if (from !== to) onMove(from, to);
  };

  if (!items.length) return <>{empty}</>;

  return (
    <ScrollView scrollEnabled={!dragging} contentContainerStyle={styles.list}>
      {items.map((item, index) => {
        const pan = Gesture.Pan()
          .enabled(enabled)
          .minDistance(0)
          .onStart(() => {
            active.value = index;
            dy.value = 0;
            scheduleOnRN(setDragging, true);
          })
          .onUpdate((e) => {
            dy.value = e.translationY;
          })
          .onEnd(() => {
            const to = targetIndex(index, dy.value, items.length);
            // Snap onto its final slot, then hand over to React.
            dy.value = withTiming((to - index) * STEP, { duration: 120 });
            scheduleOnRN(drop, index, to);
          });

        return (
          <Row key={keyOf(item)} index={index} count={items.length} active={active} dy={dy}>
            {enabled ? (
              <GestureDetector gesture={pan}>
                <View
                  style={styles.handle}
                  hitSlop={8}
                  accessibilityLabel="Drag to reorder"
                  accessibilityHint="Use the up and down buttons instead with a screen reader"
                >
                  <Text style={styles.handleText}>≡</Text>
                </View>
              </GestureDetector>
            ) : null}
            <View style={styles.rowBody}>{renderRow(item, index)}</View>
          </Row>
        );
      })}
    </ScrollView>
  );
}

function Row(props: {
  index: number;
  count: number;
  active: SharedValue<number>;
  dy: SharedValue<number>;
  children: ReactNode;
}) {
  const { index, count, active, dy } = props;

  const style = useAnimatedStyle(() => {
    const from = active.value;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0, opacity: 1 };
    if (from === index) return { transform: [{ translateY: dy.value }], zIndex: 10, opacity: 0.92 };
    // Rows between the dragged row's start and where it would land slide
    // one step to make room.
    const to = targetIndex(from, dy.value, count);
    const shift = from < index && index <= to ? -STEP : to <= index && index < from ? STEP : 0;
    return { transform: [{ translateY: withTiming(shift, { duration: 120 }) }], zIndex: 0, opacity: 1 };
  });

  const highlight = useAnimatedStyle(() => ({
    borderColor: active.value === index ? colors.primary : 'transparent',
  }));

  return <Animated.View style={[styles.row, style, highlight]}>{props.children}</Animated.View>;
}

const styles = StyleSheet.create({
  list: { gap: GAP, paddingBottom: spacing.md },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  handle: { width: 32, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  handleText: { fontSize: 20, color: colors.textMuted },
  rowBody: { flex: 1, height: ROW_HEIGHT, justifyContent: 'center' },
});

import React, { useLayoutEffect, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FeedDescriptor } from '../../services/mastodon/feedTypes';
import { useTheme } from '../../services/themeContext';
import { radii } from '../../services/theme/shape';

const HOLD_MS = 300;
const SHIFT_MS = 120;

// Where a row dragged by `dy` lands: past a neighbour once it has covered half of it
export const dropIndex = (heights: number[], from: number, dy: number) => {
    'worklet';
    let to = from;
    let left = Math.abs(dy);
    const step = dy > 0 ? 1 : -1;
    while (heights[to + step] !== undefined && left > heights[to + step] / 2) {
        to += step;
        left -= heights[to];
    }
    return to;
};

// How far a row travels from its own place to the place at `to`
export const slotOffset = (heights: number[], from: number, to: number) => {
    'worklet';
    let offset = 0;
    for (let i = from + 1; i <= to; i++) offset += heights[i];
    for (let i = to; i < from; i++) offset -= heights[i];
    return offset;
};

interface DragState {
    // The dragged row and where it would land; -1 when nothing is dragged
    from: SharedValue<number>;
    to: SharedValue<number>;
    dy: SharedValue<number>;
    heights: SharedValue<number[]>;
    // Off while the new order lands, or the rows would slide from places they just left
    shifting: SharedValue<boolean>;
}

interface PinnedRowProps {
    id: string;
    index: number;
    enabled: boolean;
    drag: DragState;
    onHeight: (index: number, height: number) => void;
    onMove: (from: number, to: number) => void;
    onDragChange: (dragging: boolean) => void;
    children: React.ReactNode;
}

const PinnedRow = ({ id, index, enabled, drag, onHeight, onMove, onDragChange, children }: PinnedRowProps) => {
    const { colors } = useTheme();
    const { from, to, dy, heights, shifting } = drag;

    const style = useAnimatedStyle(() => {
        if (from.value === index) {
            return { transform: [{ translateY: dy.value }], zIndex: 1, backgroundColor: colors.accentSoft };
        }
        const height = heights.value[from.value] ?? 0;
        let y = 0;
        if (from.value >= 0 && index > from.value && index <= to.value) y = -height;
        if (from.value >= 0 && index < from.value && index >= to.value) y = height;
        return {
            transform: [{ translateY: shifting.value ? withTiming(y, { duration: SHIFT_MS }) : y }],
            zIndex: 0,
            backgroundColor: colors.cardBackground,
        };
    });

    // A hold first, so a quick tap opens the feed and a quick drag scrolls the sheet
    const pan = Gesture.Pan()
        .withTestId(`drag-${id}`)
        .enabled(enabled)
        .activateAfterLongPress(HOLD_MS)
        .onStart(() => {
            shifting.value = true;
            dy.value = 0;
            to.value = index;
            from.value = index;
            runOnJS(onDragChange)(true);
        })
        .onUpdate(event => {
            dy.value = event.translationY;
            to.value = dropIndex(heights.value, index, event.translationY);
        })
        .onEnd((_, success) => {
            const target = success ? to.value : index;
            to.value = target;
            runOnJS(onDragChange)(false);
            dy.value = withTiming(slotOffset(heights.value, index, target), { duration: SHIFT_MS }, () => {
                if (target === index) from.value = -1;
                else runOnJS(onMove)(index, target);
            });
        });

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[{ borderRadius: radii.input }, style]} onLayout={event => onHeight(index, event.nativeEvent.layout.height)}>
                {children}
            </Animated.View>
        </GestureDetector>
    );
};

interface PinnedRowsProps {
    feeds: FeedDescriptor[];
    renderRow: (feed: FeedDescriptor, index: number) => React.ReactNode;
    onMove: (from: number, to: number) => void;
    // So the sheet can stop scrolling under the finger
    onDragChange: (dragging: boolean) => void;
}

// The pinned feeds, each held and dragged to a new place. The rows only shift on screen during a drag
// and the order changes on release: moving a native view under the finger can cancel the touch.
// ponytail: no scrolling while dragging near the sheet's edge, add it if people pin more than fit (the arrows reach them)
export const PinnedRows = ({ feeds, renderRow, onMove, onDragChange }: PinnedRowsProps) => {
    const from = useSharedValue(-1);
    const to = useSharedValue(-1);
    const dy = useSharedValue(0);
    const heights = useSharedValue<number[]>([]);
    const shifting = useSharedValue(false);
    const measured = useRef<number[]>([]);

    const onHeight = (index: number, height: number) => {
        measured.current[index] = height;
        heights.value = [...measured.current];
    };

    // The new order is drawn: every row is in its place, with nothing left to shift
    const order = feeds.map(feed => feed.id).join();
    useLayoutEffect(() => {
        shifting.value = false;
        from.value = -1;
        to.value = -1;
        dy.value = 0;
    }, [order, shifting, from, to, dy]);

    return (
        <>
            {feeds.map((feed, index) => (
                <PinnedRow
                    key={feed.id}
                    id={feed.id}
                    index={index}
                    enabled={feeds.length > 1}
                    drag={{ from, to, dy, heights, shifting }}
                    onHeight={onHeight}
                    onMove={onMove}
                    onDragChange={onDragChange}
                >
                    {renderRow(feed, index)}
                </PinnedRow>
            ))}
        </>
    );
};

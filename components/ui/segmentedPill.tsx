import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { hitSlopFor, radii, space } from '../../services/theme/shape';

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
    // Shown before the label on underline tabs
    icon?: React.ComponentProps<typeof Ionicons>['name'];
}

interface SegmentedPillProps<T extends string> {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    // "segmented" switches views (feeds); "chips" filters a list; "underline" is tabs under a header
    variant?: 'segmented' | 'chips' | 'underline';
}

const CHIP_HEIGHT = 34;
// Room left beside a tab scrolled into view, so it doesn't sit flush against the edge
const UNDERLINE_EDGE = 20;
const UNDERLINE_ARROW = 18;

// Tabs under a header. They scroll sideways when they don't all fit (a narrow phone, large text, five tabs
// on your own profile), and the chosen one scrolls fully into view.
function UnderlineTabs<T extends string>({ options, value, onChange }: Pick<SegmentedPillProps<T>, 'options' | 'value' | 'onChange'>) {
    const { colors, type } = useTheme();
    const scroll = useRef<ScrollView>(null);
    const frames = useRef<Record<string, { x: number; width: number }>>({});
    const viewport = useRef({ x: 0, width: 0, content: 0 });
    // Which ends have tabs hidden past them: shown with a fade and an arrow, so people know to swipe
    const [hidden, setHidden] = useState({ start: false, end: false });
    const measure = () => {
        const { x, width, content } = viewport.current;
        const next = { start: x > 1, end: content - width - x > 1 };
        setHidden(current => (current.start === next.start && current.end === next.end ? current : next));
    };

    useEffect(() => {
        const frame = frames.current[value];
        const { x, width } = viewport.current;
        if (!frame || width === 0) return;
        if (frame.x < x + UNDERLINE_EDGE) scroll.current?.scrollTo({ x: Math.max(frame.x - UNDERLINE_EDGE, 0) });
        else if (frame.x + frame.width > x + width - UNDERLINE_EDGE) scroll.current?.scrollTo({ x: frame.x + frame.width - width + UNDERLINE_EDGE });
    }, [value]);

    return (
        <View style={[styles.underlineBar, { borderBottomColor: colors.borderColor }]}>
            <ScrollView
                ref={scroll}
                testID="underline-tabs"
                horizontal
                showsHorizontalScrollIndicator={false}
                accessibilityRole="tablist"
                contentContainerStyle={styles.underlineRow}
                onLayout={event => {
                    viewport.current.width = event.nativeEvent.layout.width;
                    measure();
                }}
                onContentSizeChange={width => {
                    viewport.current.content = width;
                    measure();
                }}
                onScroll={event => {
                    viewport.current.x = event.nativeEvent.contentOffset.x;
                    measure();
                }}
                scrollEventThrottle={64}
            >
                {options.map(option => {
                    const selected = option.value === value;
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            onLayout={event => (frames.current[option.value] = event.nativeEvent.layout)}
                            accessibilityRole="tab"
                            // Just the label, so screen readers don't read the icon's glyph
                            accessibilityLabel={option.label}
                            accessibilityState={{ selected }}
                            style={[styles.underlineTab, { borderBottomColor: selected ? colors.accentColor : 'transparent' }]}
                        >
                            {option.icon && <Ionicons name={option.icon} size={15} color={selected ? colors.textPrimary : colors.textMuted} />}
                            <Text style={[type.name, styles.underlineLabel, { color: selected ? colors.textPrimary : colors.textMuted }]}>
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
            {hidden.start && <EdgeFade side="start" onPress={() => scroll.current?.scrollTo({ x: 0 })} />}
            {hidden.end && <EdgeFade side="end" onPress={() => scroll.current?.scrollToEnd()} />}
        </View>
    );
}

// The background fading over the tabs at an edge, with an arrow that scrolls the hidden ones into view
const EdgeFade = ({ side, onPress }: { side: 'start' | 'end'; onPress: () => void }) => {
    const { colors } = useTheme();
    const { t } = useI18n();
    const end = side === 'end';
    return (
        <View pointerEvents="box-none" style={[styles.edgeFade, end ? styles.edgeFadeEnd : styles.edgeFadeStart]}>
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={`tabs-fade-${side}`} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={colors.background} stopOpacity={end ? 0 : 1} />
                        <Stop offset="1" stopColor={colors.background} stopOpacity={end ? 1 : 0} />
                    </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#tabs-fade-${side})`} />
            </Svg>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={t(end ? 'common.moreTabs' : 'common.earlierTabs')}
                hitSlop={hitSlopFor(UNDERLINE_ARROW, 44)}
                style={styles.edgeArrow}
            >
                <Ionicons name={end ? 'chevron-forward' : 'chevron-back'} size={UNDERLINE_ARROW} color={colors.textMuted} />
            </Pressable>
        </View>
    );
};

export function SegmentedPill<T extends string>({ options, value, onChange, variant = 'segmented' }: SegmentedPillProps<T>) {
    const { colors, type } = useTheme();

    if (variant === 'chips') {
        return (
            <View style={styles.chips}>
                {options.map(option => {
                    const selected = option.value === value;
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            hitSlop={hitSlopFor(0, CHIP_HEIGHT)}
                            style={[
                                styles.chip,
                                selected
                                    ? { backgroundColor: colors.accentColor, borderColor: colors.accentColor }
                                    : { backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
                            ]}
                        >
                            <Text style={[type.name, styles.chipLabel, { color: selected ? colors.buttonTextColor : colors.textSecondary }]}>
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }

    if (variant === 'underline') {
        return <UnderlineTabs options={options} value={value} onChange={onChange} />;
    }

    return (
        <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.inputBackground }]}>
            {options.map(option => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        style={[
                            styles.segment,
                            selected && [styles.segmentSelected, { backgroundColor: colors.cardBackground, shadowColor: colors.shadowColor }],
                        ]}
                    >
                        <Text style={[type.name, styles.segmentLabel, { color: selected ? colors.textPrimary : colors.textMuted }]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        borderRadius: radii.pill,
        padding: 3,
    },
    segment: {
        flex: 1,
        // With the track padding the tab row is 44pt tall
        minHeight: 38,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentSelected: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 1,
    },
    segmentLabel: {
        fontSize: 14,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
    chip: {
        height: CHIP_HEIGHT,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipLabel: {
        fontSize: 13,
    },
    underlineBar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    edgeFade: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 56,
        justifyContent: 'center',
    },
    edgeFadeStart: {
        left: 0,
        alignItems: 'flex-start',
        paddingLeft: space.xs,
    },
    edgeFadeEnd: {
        right: 0,
        alignItems: 'flex-end',
        paddingRight: space.xs,
    },
    edgeArrow: {
        padding: space.xs,
    },
    underlineRow: {
        flexDirection: 'row',
        gap: space.xl,
        paddingHorizontal: 20,
    },
    underlineTab: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'center',
        borderBottomWidth: 3,
    },
    underlineLabel: {
        fontSize: 15,
    },
});

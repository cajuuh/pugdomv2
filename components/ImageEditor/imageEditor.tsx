import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Modal, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { mediaColors } from '../../services/theme/media';
import { MIN_TOUCH, space } from '../../services/theme/shape';
import { PickedImage } from '../../services/media/prepare';
import {
    centeredCrop,
    Corner,
    cropRatio,
    fitSize,
    flipHorizontal,
    FULL_CROP,
    ImageEdits,
    isEdited,
    moveCrop,
    NO_EDITS,
    orientedSize,
    Rect,
    resizeCrop,
    rotateClockwise,
    sameEdits,
    Size,
} from '../../services/media/geometry';
import { PillButton } from '../ui';
import { DialogHost } from '../Dialog/dialogHost';

// Smallest crop, in points on screen
const MIN_CROP = 48;
const HANDLE_SIZE = 22;
const HANDLE_STROKE = 3;
const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

interface ImageEditorProps {
    visible: boolean;
    // The original image; edits always start from it, so a crop can be undone later
    image: PickedImage | null;
    initialEdits?: ImageEdits;
    // Locks the crop to width / height (1 for an avatar, 3 for a header)
    aspect?: number;
    onCancel: () => void;
    onDone: (edits: ImageEdits) => Promise<void> | void;
}

const startingEdits = (aspect: number | undefined, size: Size): ImageEdits =>
    aspect ? { ...NO_EDITS, crop: centeredCrop(cropRatio(aspect, size)) } : NO_EDITS;

// Crops, turns and mirrors an image: drag the corners to resize the crop and inside it to move it
export const ImageEditor: React.FC<ImageEditorProps> = ({ visible, image, initialEdits, aspect, onCancel, onDone }) => {
    const { type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const [edits, setEdits] = useState<ImageEdits>(NO_EDITS);
    const [size, setSize] = useState<Size | null>(null);
    const [stage, setStage] = useState<Size>({ width: 0, height: 0 });
    const [saving, setSaving] = useState(false);

    // The picker's size can miss a photo's orientation; ask the image itself, falling back to it
    useEffect(() => {
        if (!visible || !image) return;
        let current = true;
        const picked = { width: image.width, height: image.height };
        setSize(picked);
        setEdits(initialEdits ?? startingEdits(aspect, picked));
        setSaving(false);
        Image.getSize(image.uri)
            .then(({ width, height }) => {
                if (current && (width !== picked.width || height !== picked.height)) {
                    setSize({ width, height });
                    if (!initialEdits) setEdits(startingEdits(aspect, { width, height }));
                }
            })
            .catch(() => {
                // keep the picker's size
            });
        return () => {
            current = false;
        };
    }, [visible, image, initialEdits, aspect]);

    const oriented = size ? orientedSize(size, edits.rotation) : { width: 0, height: 0 };
    const display = fitSize(stage, oriented);
    // The crop's width / height in 0–1 units, when locked
    const ratio = aspect && oriented.width ? cropRatio(aspect, oriented) : undefined;

    // Drag handlers read the latest values through refs: they're made once
    const latest = useRef({ edits, display, ratio });
    latest.current = { edits, display, ratio };

    const dragResponder = (drag: (start: Rect, dx: number, dy: number) => Rect) => {
        let start = FULL_CROP;
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
                start = latest.current.edits.crop;
            },
            onPanResponderMove: (_, gesture) => {
                const { display: box } = latest.current;
                if (!box.width || !box.height) return;
                const crop = drag(start, gesture.dx / box.width, gesture.dy / box.height);
                setEdits(current => ({ ...current, crop }));
            },
        });
    };

    const moveResponder = useMemo(() => dragResponder((start, dx, dy) => moveCrop(start, dx, dy)), []);
    const cornerResponders = useMemo(
        () =>
            Object.fromEntries(
                CORNERS.map(corner => [
                    corner,
                    dragResponder((start, dx, dy) => {
                        const { display: box, ratio: locked } = latest.current;
                        return resizeCrop(start, corner, dx, dy, { minWidth: MIN_CROP / box.width, minHeight: MIN_CROP / box.height, ratio: locked });
                    }),
                ])
            ) as Record<Corner, ReturnType<typeof PanResponder.create>>,
        []
    );

    const rotate = () =>
        setEdits(current => {
            const turned = rotateClockwise(current);
            // A locked shape doesn't survive a quarter turn: start again centered
            if (!aspect || !size) return turned;
            return { ...turned, crop: centeredCrop(cropRatio(aspect, orientedSize(size, turned.rotation))) };
        });
    const flip = () => setEdits(flipHorizontal);
    const reset = () => size && setEdits(startingEdits(aspect, size));

    const done = async () => {
        setSaving(true);
        try {
            await onDone(edits);
        } finally {
            setSaving(false);
        }
    };

    const onStageLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        // Room for the corner handles to stay grabbable at the edges
        setStage({ width: Math.max(width - 2 * MIN_TOUCH, 0), height: Math.max(height - 2 * MIN_TOUCH, 0) });
    };

    // The image drawn unturned, then turned and mirrored into the display box
    const quarterTurn = edits.rotation % 180 !== 0;
    const drawn = quarterTurn ? { width: display.height, height: display.width } : display;
    const crop = {
        left: edits.crop.x * display.width,
        top: edits.crop.y * display.height,
        width: edits.crop.width * display.width,
        height: edits.crop.height * display.height,
    };
    const resetDisabled = !size || !isEdited(edits) || sameEdits(edits, startingEdits(aspect, size));

    return (
        <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
            <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
                <View style={styles.header}>
                    <View style={styles.headerSide}>
                        <PillButton label={t('common.cancel')} variant="ghost" onPress={onCancel} />
                    </View>
                    <Text accessibilityRole="header" style={[type.sheetTitle, styles.title]} numberOfLines={1}>
                        {t('editor.title')}
                    </Text>
                    <View style={[styles.headerSide, styles.headerSideEnd]}>
                        <PillButton label={t('compose.done')} onPress={done} loading={saving} disabled={!size} />
                    </View>
                </View>

                <View style={styles.stage} onLayout={onStageLayout} testID="image-editor-stage">
                    {image && display.width > 0 && (
                        <View style={{ width: display.width, height: display.height }}>
                            <Image
                                source={{ uri: image.uri }}
                                accessibilityIgnoresInvertColors
                                style={{
                                    position: 'absolute',
                                    width: drawn.width,
                                    height: drawn.height,
                                    left: (display.width - drawn.width) / 2,
                                    top: (display.height - drawn.height) / 2,
                                    // Listed last, applied first: turn, then mirror
                                    transform: [{ scaleX: edits.flipped ? -1 : 1 }, { rotate: `${edits.rotation}deg` }],
                                }}
                            />

                            {/* Dims what the crop leaves out */}
                            <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: crop.top }]} />
                            <View pointerEvents="none" style={[styles.shade, { left: 0, right: 0, top: crop.top + crop.height, bottom: 0 }]} />
                            <View pointerEvents="none" style={[styles.shade, { left: 0, top: crop.top, width: crop.left, height: crop.height }]} />
                            <View
                                pointerEvents="none"
                                style={[styles.shade, { left: crop.left + crop.width, right: 0, top: crop.top, height: crop.height }]}
                            />

                            <View
                                {...moveResponder.panHandlers}
                                accessible
                                accessibilityLabel={t('editor.cropArea')}
                                accessibilityHint={t('editor.cropAreaHint')}
                                style={[styles.frame, crop]}
                            >
                                {/* Rule of thirds */}
                                <View pointerEvents="none" style={[styles.third, { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
                                <View pointerEvents="none" style={[styles.third, { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
                                <View pointerEvents="none" style={[styles.third, { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
                                <View pointerEvents="none" style={[styles.third, { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
                            </View>

                            {CORNERS.map(corner => {
                                const right = corner === 'topRight' || corner === 'bottomRight';
                                const bottom = corner === 'bottomLeft' || corner === 'bottomRight';
                                return (
                                    <View
                                        key={corner}
                                        {...cornerResponders[corner].panHandlers}
                                        accessible
                                        accessibilityLabel={t(`editor.${corner}`)}
                                        accessibilityHint={t('editor.cornerHint')}
                                        style={[
                                            styles.handle,
                                            {
                                                left: crop.left + (right ? crop.width : 0) - MIN_TOUCH / 2,
                                                top: crop.top + (bottom ? crop.height : 0) - MIN_TOUCH / 2,
                                            },
                                        ]}
                                    >
                                        {/* An L along the crop's corner */}
                                        <View
                                            pointerEvents="none"
                                            style={[
                                                styles.handleMark,
                                                right ? { right: MIN_TOUCH / 2 - HANDLE_STROKE / 2 } : { left: MIN_TOUCH / 2 - HANDLE_STROKE / 2 },
                                                bottom ? { bottom: MIN_TOUCH / 2 - HANDLE_STROKE / 2 } : { top: MIN_TOUCH / 2 - HANDLE_STROKE / 2 },
                                                right ? { borderLeftWidth: 0 } : { borderRightWidth: 0 },
                                                bottom ? { borderTopWidth: 0 } : { borderBottomWidth: 0 },
                                            ]}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                <View style={styles.tools}>
                    <PillButton label={t('editor.rotate')} icon="refresh" variant="secondary" onPress={rotate} disabled={!size} />
                    <PillButton label={t('editor.flip')} icon="swap-horizontal" variant="secondary" onPress={flip} disabled={!size} />
                    <PillButton label={t('editor.reset')} icon="arrow-undo" variant="secondary" onPress={reset} disabled={resetDisabled} />
                </View>
            </View>
            <DialogHost active={visible} />
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: mediaColors.backdrop,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
    },
    // Equal sides keep the title centered
    headerSide: {
        flex: 1,
        flexDirection: 'row',
    },
    headerSideEnd: {
        justifyContent: 'flex-end',
    },
    title: {
        color: mediaColors.ink,
    },
    stage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shade: {
        position: 'absolute',
        backgroundColor: mediaColors.scrim,
    },
    frame: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: mediaColors.ink,
    },
    third: {
        position: 'absolute',
        backgroundColor: mediaColors.ink,
        opacity: 0.4,
    },
    handle: {
        position: 'absolute',
        width: MIN_TOUCH,
        height: MIN_TOUCH,
    },
    handleMark: {
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderColor: mediaColors.ink,
        borderWidth: HANDLE_STROKE,
    },
    tools: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: space.sm,
        paddingHorizontal: space.lg,
    },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mediaColors } from '../../services/theme/media';
import { useI18n } from '../../services/i18n/i18nContext';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
// A downward drag past this (or a fast flick) closes the viewer
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 800;
const SPRING = { damping: 20, stiffness: 200 };

export interface GalleryImage {
    uri: string;
    description?: string | null;
}

const clamp = (value: number, min: number, max: number) => {
    'worklet';
    return Math.min(Math.max(value, min), max);
};

interface ZoomableImageProps {
    image: GalleryImage;
    width: number;
    height: number;
    // How far the open image is being dragged down to close; drives the backdrop
    dismiss: SharedValue<number>;
    onZoomChange: (zoomed: boolean) => void;
    // Two fingers are down: the gallery stops paging so the pinch isn't taken for a swipe
    onPinchStart: () => void;
    onClose: () => void;
}

// One image: pinch to zoom (up to 4×), drag around while zoomed, double tap to zoom in on a spot or back out;
// at normal size a downward drag closes the viewer
const ZoomableImage = ({ image, width, height, dismiss, onZoomChange, onPinchStart, onClose }: ZoomableImageProps) => {
    const [zoomed, setZoomed] = useState(false);
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const savedX = useSharedValue(0);
    const savedY = useSharedValue(0);

    const reportZoom = useCallback(
        (next: boolean) => {
            setZoomed(next);
            onZoomChange(next);
        },
        [onZoomChange]
    );

    // How far the image may move at a scale before its edge leaves the screen's edge
    const bound = (size: number, s: number) => {
        'worklet';
        return (size * (s - 1)) / 2;
    };

    const settle = () => {
        'worklet';
        if (scale.value <= 1) {
            scale.value = withSpring(1, SPRING);
            x.value = withSpring(0, SPRING);
            y.value = withSpring(0, SPRING);
            savedScale.value = 1;
            savedX.value = 0;
            savedY.value = 0;
            runOnJS(reportZoom)(false);
            return;
        }
        savedScale.value = scale.value;
        savedX.value = clamp(x.value, -bound(width, scale.value), bound(width, scale.value));
        savedY.value = clamp(y.value, -bound(height, scale.value), bound(height, scale.value));
        x.value = withSpring(savedX.value, SPRING);
        y.value = withSpring(savedY.value, SPRING);
        runOnJS(reportZoom)(true);
    };

    const pinch = Gesture.Pinch()
        .onTouchesDown(event => {
            if (event.numberOfTouches >= 2) runOnJS(onPinchStart)();
        })
        .onUpdate(event => {
            scale.value = clamp(savedScale.value * event.scale, 0.8, MAX_SCALE);
        })
        .onEnd(settle);

    // Zoomed: move around the picture. At normal size: only vertical drags, to close (horizontal ones page)
    const pan = zoomed
        ? Gesture.Pan()
              .averageTouches(true)
              .onUpdate(event => {
                  x.value = savedX.value + event.translationX;
                  y.value = savedY.value + event.translationY;
              })
              .onEnd(settle)
        : Gesture.Pan()
              .withTestId('gallery-dismiss')
              .activeOffsetY([-12, 12])
              .failOffsetX([-20, 20])
              .onUpdate(event => {
                  y.value = event.translationY;
                  dismiss.value = event.translationY;
              })
              .onEnd(event => {
                  if (Math.abs(event.translationY) > CLOSE_DISTANCE || Math.abs(event.velocityY) > CLOSE_VELOCITY) {
                      runOnJS(onClose)();
                      return;
                  }
                  y.value = withSpring(0, SPRING);
                  dismiss.value = withTiming(0);
              });

    // Gives up as soon as a finger moves, so a pinch or drag doesn't wait for it
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDistance(10)
        .onEnd(event => {
            if (scale.value > 1) {
                scale.value = 1;
            } else {
                // Zoom in keeping the tapped spot under the finger
                scale.value = DOUBLE_TAP_SCALE;
                x.value = (event.x - width / 2) * (1 - DOUBLE_TAP_SCALE);
                y.value = (event.y - height / 2) * (1 - DOUBLE_TAP_SCALE);
            }
            settle();
        });

    const style = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    }));

    return (
        <GestureDetector gesture={Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan))}>
            <Animated.View style={[{ width, height }, style]} collapsable={false}>
                <Image
                    source={{ uri: image.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                    accessibilityLabel={image.description || undefined}
                />
            </Animated.View>
        </GestureDetector>
    );
};

interface ImageGalleryProps {
    images: GalleryImage[];
    index: number;
    visible: boolean;
    onClose: () => void;
    // Shown across from the close button, e.g. "View post"
    extraButton?: React.ReactNode;
}

// The full-screen image viewer: swipe between images, pinch or double tap to zoom, drag down to close.
// Built on gesture handler + reanimated (already in the app's builds), replacing react-native-image-viewing,
// whose Android gestures stopped working on React Native 0.85.
export const ImageGallery = ({ images, index, visible, onClose, extraButton }: ImageGalleryProps) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const [current, setCurrent] = useState(index);
    const [zoomed, setZoomed] = useState(false);
    const dismiss = useSharedValue(0);
    const list = useRef<FlatList<GalleryImage>>(null);

    // The gallery stays mounted between openings: each one starts at the tapped image, unzoomed, in place
    useEffect(() => {
        if (!visible) return;
        setCurrent(index);
        setZoomed(false);
        dismiss.value = 0;
        // Only on opening (or a new start image); the shared value is a stable box
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, index]);

    const backdrop = useAnimatedStyle(() => ({
        opacity: interpolate(Math.abs(dismiss.value), [0, height / 2], [1, 0.2], 'clamp'),
    }));

    const go = (to: number) => {
        setCurrent(to);
        list.current?.scrollToIndex({ index: to, animated: true });
    };

    const close = () => {
        dismiss.value = 0;
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            navigationBarTranslucent
            animationType="fade"
            onRequestClose={close}
        >
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: mediaColors.scrimStrong }, backdrop]} />
                <FlatList
                    ref={list}
                    data={images}
                    horizontal
                    pagingEnabled
                    scrollEnabled={!zoomed}
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={index}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                    keyExtractor={(image, i) => `${i}-${image.uri}`}
                    onMomentumScrollEnd={event => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
                    renderItem={({ item }) => (
                        <ZoomableImage
                            image={item}
                            width={width}
                            height={height}
                            dismiss={dismiss}
                            onZoomChange={setZoomed}
                            onPinchStart={() => setZoomed(true)}
                            onClose={close}
                        />
                    )}
                />

                <TouchableOpacity
                    onPress={close}
                    style={[styles.closeButton, { top: insets.top + 12 }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('media.close')}
                >
                    <Ionicons name="close" size={30} color={mediaColors.ink} />
                </TouchableOpacity>
                {extraButton}

                {images.length > 1 && (
                    <>
                        <Text style={[styles.counter, { bottom: insets.bottom + 24 }]}>
                            {current + 1} / {images.length}
                        </Text>
                        {current > 0 && (
                            <TouchableOpacity
                                onPress={() => go(current - 1)}
                                style={[styles.navButton, styles.navLeft]}
                                accessibilityRole="button"
                                accessibilityLabel={t('media.previous')}
                            >
                                <Ionicons name="chevron-back" size={24} color={mediaColors.ink} />
                            </TouchableOpacity>
                        )}
                        {current < images.length - 1 && (
                            <TouchableOpacity
                                onPress={() => go(current + 1)}
                                style={[styles.navButton, styles.navRight]}
                                accessibilityRole="button"
                                accessibilityLabel={t('media.next')}
                            >
                                <Ionicons name="chevron-forward" size={24} color={mediaColors.ink} />
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    // Right, as in the video viewer; "View post" sits on the left
    closeButton: {
        position: 'absolute',
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: mediaColors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    counter: {
        position: 'absolute',
        alignSelf: 'center',
        color: mediaColors.ink,
        fontSize: 14,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: mediaColors.scrim,
        overflow: 'hidden',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -22,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: mediaColors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navLeft: {
        left: 12,
    },
    navRight: {
        right: 12,
    },
});

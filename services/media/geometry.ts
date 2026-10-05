// Crop maths for the image editor, kept free of React so it can be tested on its own.
// What you see is the original turned by `rotation` (clockwise), then mirrored when `flipped`;
// the crop is a rect over that, in 0–1 of its width and height. expo-image-manipulator applies
// the same steps in the same order (rotate, flip, crop).

export type Rotation = 0 | 90 | 180 | 270;
export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface Size {
    width: number;
    height: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ImageEdits {
    rotation: Rotation;
    flipped: boolean;
    crop: Rect;
}

export const FULL_CROP: Rect = { x: 0, y: 0, width: 1, height: 1 };
export const NO_EDITS: ImageEdits = { rotation: 0, flipped: false, crop: FULL_CROP };

const EPSILON = 1e-4;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const isFullCrop = (crop: Rect) =>
    crop.x < EPSILON && crop.y < EPSILON && crop.width > 1 - EPSILON && crop.height > 1 - EPSILON;

export const isEdited = (edits: ImageEdits) => edits.rotation !== 0 || edits.flipped || !isFullCrop(edits.crop);

export const sameEdits = (a: ImageEdits, b: ImageEdits) =>
    a.rotation === b.rotation &&
    a.flipped === b.flipped &&
    (['x', 'y', 'width', 'height'] as const).every(side => Math.abs(a.crop[side] - b.crop[side]) < EPSILON);

// Width and height swap a quarter turn away
export const orientedSize = (size: Size, rotation: Rotation): Size =>
    rotation % 180 === 0 ? size : { width: size.height, height: size.width };

// The biggest size with the image's shape that fits in `box`
export const fitSize = (box: Size, image: Size): Size => {
    if (image.width <= 0 || image.height <= 0) return { width: 0, height: 0 };
    const scale = Math.min(box.width / image.width, box.height / image.height);
    return { width: image.width * scale, height: image.height * scale };
};

// A pixel aspect (width / height) as a ratio of the 0–1 crop's sides over an image of `image` size
export const cropRatio = (aspect: number, image: Size) => aspect * (image.height / image.width);

// The largest centered crop with that ratio of sides
export const centeredCrop = (ratio: number): Rect => {
    // Wider than the image: full width; taller: full height
    const width = Math.min(1, ratio);
    const height = width / ratio;
    return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
};

// Turns what you see a quarter clockwise, the crop with it. A mirrored image turns the other
// way underneath (mirroring reverses rotation), so it still turns clockwise on screen.
export const rotateClockwise = (edits: ImageEdits): ImageEdits => {
    const { x, y, width, height } = edits.crop;
    const rotation = ((edits.rotation + (edits.flipped ? 270 : 90)) % 360) as Rotation;
    return { ...edits, rotation, crop: { x: 1 - y - height, y: x, width: height, height: width } };
};

// Mirrors what you see left to right, the crop with it
export const flipHorizontal = (edits: ImageEdits): ImageEdits => ({
    ...edits,
    flipped: !edits.flipped,
    crop: { ...edits.crop, x: 1 - edits.crop.x - edits.crop.width },
});

// Drags the whole crop, keeping it on the image
export const moveCrop = (crop: Rect, dx: number, dy: number): Rect => ({
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
});

interface ResizeOptions {
    // Smallest sides, in 0–1 of the image
    minWidth: number;
    minHeight: number;
    // Locks the crop's width / height (see cropRatio)
    ratio?: number;
}

// Drags one corner; the opposite corner stays put and the crop stays on the image
export const resizeCrop = (crop: Rect, corner: Corner, dx: number, dy: number, { minWidth, minHeight, ratio }: ResizeOptions): Rect => {
    const left = corner === 'topLeft' || corner === 'bottomLeft';
    const top = corner === 'topLeft' || corner === 'topRight';
    const anchorX = left ? crop.x + crop.width : crop.x;
    const anchorY = top ? crop.y + crop.height : crop.y;
    // Room from the fixed corner to the image's edge, on the side being dragged
    const roomX = left ? anchorX : 1 - anchorX;
    const roomY = top ? anchorY : 1 - anchorY;

    let width = clamp(crop.width + (left ? -dx : dx), Math.min(minWidth, roomX), roomX);
    let height = clamp(crop.height + (top ? -dy : dy), Math.min(minHeight, roomY), roomY);

    if (ratio) {
        // Follow the direction dragged most, then fit the room and the minimum
        if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio;
        else width = height * ratio;
        if (width > roomX) [width, height] = [roomX, roomX / ratio];
        if (height > roomY) [width, height] = [roomY * ratio, roomY];
        if (width < minWidth && minWidth / ratio <= roomY) [width, height] = [minWidth, minWidth / ratio];
        if (height < minHeight && minHeight * ratio <= roomX) [width, height] = [minHeight * ratio, minHeight];
    }

    return { x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height };
};

// The crop in whole pixels of an image of `size`, never past its edges
export const cropPixels = (crop: Rect, size: Size) => {
    const originX = clamp(Math.round(crop.x * size.width), 0, size.width - 1);
    const originY = clamp(Math.round(crop.y * size.height), 0, size.height - 1);
    return {
        originX,
        originY,
        width: clamp(Math.round(crop.width * size.width), 1, size.width - originX),
        height: clamp(Math.round(crop.height * size.height), 1, size.height - originY),
    };
};

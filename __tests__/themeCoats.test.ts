import { buildColors, COATS, hslToHex, isCoatKey, pugMarkColors, ThemeColors } from '../services/theme/coats';

// WCAG 2.x relative luminance and contrast ratio
const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
    ['textPrimary', 'background'],
    ['textMuted', 'background'],
    ['accentText', 'background'],
    ['accentText', 'cardBackground'],
    ['buttonTextColor', 'accentColor'],
];

describe('coat palettes', () => {
    const cases = COATS.flatMap(coat =>
        [false, true].flatMap(dark => [true, false].map(tint => [coat.key, dark ? 'dark' : 'light', tint] as const))
    );

    it.each(cases)('%s %s (tint %s) keeps text at 4.5:1 or more', (coat, mode, tint) => {
        const colors = buildColors(coat, mode === 'dark', tint);
        for (const [fg, bg] of PAIRS) {
            expect({ pair: `${fg} on ${bg}`, ratio: contrast(colors[fg], colors[bg]) >= 4.5 })
                .toEqual({ pair: `${fg} on ${bg}`, ratio: true });
        }
    });

    it('generates the Apricot tokens from the design plan', () => {
        expect(buildColors('apricot', false, true)).toMatchObject({
            background: '#FBF4EF',
            cardBackground: '#FEFBF8',
            inputBackground: '#F4EBE3',
            borderColor: '#E9DACE',
            textPrimary: '#241B14',
            textSecondary: '#5F5145',
            textMuted: '#75685C',
            accentColor: '#E8995A',
            buttonTextColor: '#2A1D15',
            accentText: '#A4521A',
            accentSoft: '#F8E4D3',
            dangerColor: '#B83A26',
            tabBarActiveColor: '#A4521A',
            tabBarInactiveColor: '#75685C',
            tabBarBackground: '#FEFBF8F2',
        });
        expect(buildColors('apricot', true, true)).toMatchObject({
            background: '#16120E',
            cardBackground: '#201A16',
            inputBackground: '#2B251F',
            borderColor: '#3A332C',
            textPrimary: '#F7EFE9',
            textSecondary: '#CDC1B7',
            textMuted: '#A89D94',
            accentColor: '#F0A868',
            buttonTextColor: '#1E140D',
            accentText: '#F4B27A',
            accentSoft: '#412F20',
            dangerColor: '#F08A74',
        });
    });

    it('uses a dark shadow in both modes', () => {
        expect(buildColors('apricot', false, true).shadowColor).toBe(buildColors('apricot', false, true).textPrimary);
        expect(buildColors('apricot', true, true).shadowColor).toBe('#000000');
    });

    it('keeps the accent but mutes the neutrals when the tint is off', () => {
        const tinted = buildColors('sage', false, true);
        const untinted = buildColors('sage', false, false);
        expect(untinted.accentColor).toBe(tinted.accentColor);
        expect(untinted.background).not.toBe(tinted.background);
    });

    it('falls back to Apricot for an unknown coat', () => {
        expect(isCoatKey('corgi')).toBe(false);
        expect(buildColors('corgi', false, true)).toEqual(buildColors('apricot', false, true));
    });

    it('draws the PugMark in the coat accent, with a mask that shows on a black pug', () => {
        expect(pugMarkColors('fawn', false)).toEqual({ face: '#E2B45C', mask: '#2A1D15' });
        expect(pugMarkColors('fawn', true).face).toBe('#E8BE6A');
        for (const dark of [false, true]) {
            const { face, mask } = pugMarkColors('black', dark);
            expect(contrast(face, mask)).toBeGreaterThan(1.5);
        }
    });

    it('converts HSL to hex', () => {
        expect(hslToHex(0, 100, 50)).toBe('#FF0000');
        expect(hslToHex(120, 100, 25)).toBe('#008000');
        expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
    });
});

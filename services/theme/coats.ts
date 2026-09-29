export interface ThemeColors {
    background: string;
    cardBackground: string;
    borderColor: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentColor: string;
    // Accent as text: links, active labels, "near the limit"
    accentText: string;
    // Accent as a soft fill: chips, content warnings, selected rows
    accentSoft: string;
    tabBarBackground: string;
    tabBarActiveColor: string;
    tabBarInactiveColor: string;
    inputBackground: string;
    // Ink on an accent fill (dark for every coat but black pug in light mode)
    buttonTextColor: string;
    dangerColor: string;
    // Ink in light mode; black in dark mode, where a light shadow would glow
    shadowColor: string;
    // Dims the screen behind modals and menus
    scrim: string;
}

export type CoatKey = 'apricot' | 'fawn' | 'brindle' | 'black' | 'silver' | 'sage' | 'blueberry' | 'plum' | 'rose';

export interface Coat {
    key: CoatKey;
    name: string;
    // Hue the neutrals are generated from
    hue: number;
    // How strongly the hue tints the neutrals (0..1)
    neutralTint: number;
    light: { accent: string; accentText: string; onAccent: string };
    dark: { accent: string; accentText: string; onAccent: string };
}

export const COATS: readonly Coat[] = [
    { key: 'apricot', name: 'Apricot', hue: 28, neutralTint: 1,
        light: { accent: '#E8995A', accentText: '#A4521A', onAccent: '#2A1D15' },
        dark: { accent: '#F0A868', accentText: '#F4B27A', onAccent: '#1E140D' } },
    { key: 'fawn', name: 'Fawn', hue: 40, neutralTint: 0.9,
        light: { accent: '#E2B45C', accentText: '#86610F', onAccent: '#2A1F0E' },
        dark: { accent: '#E8BE6A', accentText: '#EDC77A', onAccent: '#1F170A' } },
    { key: 'brindle', name: 'Brindle', hue: 20, neutralTint: 0.6,
        light: { accent: '#B7825F', accentText: '#7E4A2E', onAccent: '#22160F' },
        dark: { accent: '#C9936F', accentText: '#DDA886', onAccent: '#1A110B' } },
    { key: 'black', name: 'Black pug', hue: 25, neutralTint: 0.15,
        light: { accent: '#2E2622', accentText: '#2E2622', onAccent: '#FFF8F1' },
        dark: { accent: '#E9DFD6', accentText: '#EFE6DD', onAccent: '#1A1512' } },
    { key: 'silver', name: 'Silver', hue: 210, neutralTint: 0.25,
        light: { accent: '#A9B4BC', accentText: '#4A5863', onAccent: '#1A2025' },
        dark: { accent: '#B5C0C8', accentText: '#C3CED6', onAccent: '#12171B' } },
    { key: 'sage', name: 'Sage', hue: 100, neutralTint: 0.5,
        light: { accent: '#9DBE8C', accentText: '#4A6B3C', onAccent: '#18230F' },
        dark: { accent: '#A9C99A', accentText: '#B6D4A7', onAccent: '#131B0C' } },
    { key: 'blueberry', name: 'Blueberry', hue: 225, neutralTint: 0.5,
        light: { accent: '#8FA8E0', accentText: '#3F5BA0', onAccent: '#101830' },
        dark: { accent: '#9DB3E8', accentText: '#AFC2EE', onAccent: '#0E1428' } },
    { key: 'plum', name: 'Plum', hue: 300, neutralTint: 0.45,
        light: { accent: '#C799C9', accentText: '#7D4A80', onAccent: '#24122A' },
        dark: { accent: '#D0A6D2', accentText: '#DDB6DF', onAccent: '#1D0F20' } },
    { key: 'rose', name: 'Rose', hue: 2, neutralTint: 0.55,
        light: { accent: '#EE9A98', accentText: '#A6423F', onAccent: '#2A1212' },
        dark: { accent: '#F2A6A4', accentText: '#F5B1AF', onAccent: '#220E0E' } },
];

export const DEFAULT_COAT: CoatKey = 'apricot';

// With the tint switched off, neutrals keep a trace of the hue so they don't look cold
const UNTINTED_NEUTRAL_TINT = 0.12;

export const isCoatKey = (value: string): value is CoatKey => COATS.some(coat => coat.key === value);

export const getCoat = (key: string): Coat => COATS.find(coat => coat.key === key) ?? COATS[0];

// HSL (degrees, percent, percent) to #RRGGBB
export function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
        const k = (n + h / 30) % 12;
        const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return ('#' + channel(0) + channel(8) + channel(4)).toUpperCase();
}

export function buildColors(coatKey: string, dark: boolean, tint: boolean): ThemeColors {
    const coat = getCoat(coatKey);
    const { hue } = coat;
    const neutralTint = tint ? coat.neutralTint : UNTINTED_NEUTRAL_TINT;
    const sat = (value: number) => value * neutralTint;
    const accent = dark ? coat.dark : coat.light;

    const neutrals = dark
        ? {
            ground: hslToHex(hue, sat(22), 7),
            surface: hslToHex(hue, sat(18), 10.5),
            sunken: hslToHex(hue, sat(16), 14.5),
            line: hslToHex(hue, sat(14), 20),
            ink: hslToHex(hue, sat(45), 94),
            ink2: hslToHex(hue, sat(18), 76),
            ink3: hslToHex(hue, sat(10), 62),
            accentSoft: hslToHex(hue, Math.max(8, 34 * coat.neutralTint), 19),
            danger: '#F08A74',
        }
        : {
            ground: hslToHex(hue, sat(60), 96),
            surface: hslToHex(hue, sat(70), 98.5),
            sunken: hslToHex(hue, sat(45), 92.5),
            line: hslToHex(hue, sat(38), 86),
            ink: hslToHex(hue, sat(30), 11),
            ink2: hslToHex(hue, sat(16), 32),
            ink3: hslToHex(hue, sat(12), 41),
            accentSoft: hslToHex(hue, Math.max(14, 72 * coat.neutralTint), 90),
            danger: '#B83A26',
        };

    return {
        background: neutrals.ground,
        cardBackground: neutrals.surface,
        inputBackground: neutrals.sunken,
        borderColor: neutrals.line,
        textPrimary: neutrals.ink,
        textSecondary: neutrals.ink2,
        textMuted: neutrals.ink3,
        accentColor: accent.accent,
        accentText: accent.accentText,
        accentSoft: neutrals.accentSoft,
        buttonTextColor: accent.onAccent,
        // Surface at 95% opacity
        tabBarBackground: neutrals.surface + 'F2',
        tabBarActiveColor: accent.accentText,
        tabBarInactiveColor: neutrals.ink3,
        dangerColor: neutrals.danger,
        shadowColor: dark ? '#000000' : neutrals.ink,
        scrim: dark ? '#000000A6' : neutrals.ink + '66',
    };
}

// Renders Pugdom's app icons and splash into assets/ from the pug mark.
//   yarn icons            (writes to assets/)
//   yarn icons some/dir   (writes elsewhere, e.g. to preview)
// The shapes mirror components/ui/pugMark.tsx and the colours mirror pugMarkColors() in services/theme/coats.ts:
// change them together. The pug is the author's, missing their left eye (on our right).
// Icons and splash are native build-time assets: new ones only ship with a new EAS build, never over OTA.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'assets'));
fs.mkdirSync(OUT, { recursive: true });

// Blend two #RRGGBB colours (mixHex in coats.ts)
const mix = (a, b, t) => {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

const MASK = { light: ['#6E5650', '#4B3531'], dark: ['#8E6F65', '#6A4D45'] };
const INK = '#2B1B18';

// The icons use the default Apricot coat
const apricot = mode => {
    const accent = mode === 'dark' ? '#F0A868' : '#E8995A';
    return { faceTop: mix(accent, '#FFEBB0', 0.62), faceBottom: accent, maskTop: MASK[mode][0], maskBottom: MASK[mode][1], ink: INK, wrinkle: INK };
};

// Shapes in 64-unit coordinates; ears, nose and muzzle get round corners from a thick stroke of their own fill
const LEFT_EAR = '10.2,25 15.2,21.2 16.2,23 13.8,30 10.8,29.6';
const RIGHT_EAR = '53.8,25 48.8,21.2 47.8,23 50.2,30 53.2,29.6';
const MUZZLE = '32,38 28.6,38.3 26,40.8 25.9,43 32,44.6 38.1,43 38,40.8 35.4,38.3';
const NOSE = '29.6,33.4 34.4,33.4 32,36.2';
const FACE = 'M 21 16.5 H 43 Q 51.5 16.5 51.5 25 V 40.5 Q 51.5 44 46 45.3 Q 32 48 18 45.3 Q 12.5 44 12.5 40.5 V 25 Q 12.5 16.5 21 16.5 Z';
const WRINKLE = 'M 26.2 24.6 q 1.45 -2 2.9 0 t 2.9 0 t 2.9 0 t 2.9 0';

const pugMark = ({ id = 'p', mode = 'light', colors = apricot(mode), wrinkle = true } = {}) => {
    const c = colors;
    const face = `url(#${id}face)`;
    const mask = `url(#${id}mask)`;
    const round = (w, fill) => `fill="${fill}" stroke="${fill}" stroke-width="${w}" stroke-linejoin="round"`;
    return `
    <defs>
        <linearGradient id="${id}face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.faceTop}"/><stop offset="1" stop-color="${c.faceBottom}"/></linearGradient>
        <linearGradient id="${id}mask" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.maskTop}"/><stop offset="1" stop-color="${c.maskBottom}"/></linearGradient>
        <clipPath id="${id}right"><rect x="32" y="30" width="14" height="20"/></clipPath>
    </defs>
    <path d="${FACE}" fill="${face}"/>
    <polygon points="${LEFT_EAR}" ${round(6.5, mask)}/>
    <polygon points="${RIGHT_EAR}" ${round(6.5, mask)}/>
    ${wrinkle ? `<path d="${WRINKLE}" fill="none" stroke="${c.wrinkle}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <rect x="15.7" y="27.3" width="11.2" height="10.6" rx="5.3" fill="${mask}"/>
    <rect x="37.1" y="27.3" width="11.2" height="10.6" rx="5.3" fill="${mask}"/>
    <ellipse cx="21.3" cy="32.7" rx="2" ry="2.9" fill="${c.ink}"/>
    <line x1="39.9" y1="32.8" x2="45.5" y2="32.8" stroke="${c.ink}" stroke-width="1.4" stroke-linecap="round"/>
    <polygon points="${MUZZLE}" ${round(5.2, mask)}/>
    <g clip-path="url(#${id}right)" opacity="0.12"><polygon points="${MUZZLE}" ${round(5.2, c.ink)}/></g>
    <polygon points="${NOSE}" ${round(2.4, c.ink)}/>`;
};

// A one-colour version for themed / tinted icons: ears and muzzle outlined by gaps; eye, closed eye, wrinkle and
// nose cut out
const pugStencil = (ink, id = 's') => `
    <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <polygon points="${LEFT_EAR}" fill="#fff" stroke="#fff" stroke-width="6.5" stroke-linejoin="round"/>
        <polygon points="${RIGHT_EAR}" fill="#fff" stroke="#fff" stroke-width="6.5" stroke-linejoin="round"/>
        <path d="${FACE}" fill="#000" stroke="#000" stroke-width="2"/>
        <path d="${FACE}" fill="#fff"/>
        <path d="${WRINKLE}" fill="none" stroke="#000" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
        <ellipse cx="21.3" cy="32.7" rx="2.4" ry="3.3" fill="#000"/>
        <line x1="39.6" y1="32.8" x2="45.8" y2="32.8" stroke="#000" stroke-width="1.8" stroke-linecap="round"/>
        <polygon points="${MUZZLE}" fill="#000" stroke="#000" stroke-width="7.2" stroke-linejoin="round"/>
        <polygon points="${MUZZLE}" fill="#fff" stroke="#fff" stroke-width="5.2" stroke-linejoin="round"/>
        <polygon points="${NOSE}" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/>
    </mask></defs>
    <rect x="0" y="0" width="64" height="64" fill="${ink}" mask="url(#${id})"/>`;

const GROUND = { light: '#FBF4EF', dark: '#16120E' };

// `box` is the px size of the mark's 52-unit crop ("6 6 52 52"); the pug fills ~96% of its width
const svg = ({ size = 1024, box, ground, body }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${ground ? `<rect width="${size}" height="${size}" fill="${ground}"/>` : ''}
    <svg x="${(size - box) / 2}" y="${(size - box) / 2}" width="${box}" height="${box}" viewBox="6 6 52 52">${body}</svg>
</svg>`;

const ICON = 700;     // pug ~670px wide on the 1024 iOS icon
const ADAPTIVE = 590; // keeps the ear tips inside Android's 66dp safe circle (r = 313px)
const SPLASH = 1024;  // shown at imageWidth, so fill the canvas

const files = {
    'icon.png': svg({ box: ICON, ground: GROUND.light, body: pugMark({ mode: 'light' }) }),
    'icon-dark.png': svg({ box: ICON, ground: GROUND.dark, body: pugMark({ mode: 'dark' }) }),
    'icon-tinted.png': svg({ box: ICON, ground: '#000000', body: pugStencil('#FFFFFF') }),
    'android-icon-foreground.png': svg({ box: ADAPTIVE, body: pugMark({ mode: 'light' }) }),
    'android-icon-monochrome.png': svg({ box: ADAPTIVE, body: pugStencil('#FFFFFF') }),
    'splash-icon.png': svg({ box: SPLASH, body: pugMark({ mode: 'light' }) }),
    'splash-icon-dark.png': svg({ box: SPLASH, body: pugMark({ mode: 'dark' }) }),
    'favicon.png': svg({ size: 48, box: 48, body: pugMark({ mode: 'light', wrinkle: false }) }),
};

for (const [name, source] of Object.entries(files)) {
    const png = new Resvg(source, { background: 'rgba(0,0,0,0)' }).render().asPng();
    fs.writeFileSync(path.join(OUT, name), png);
    console.log(name, png.length);
}

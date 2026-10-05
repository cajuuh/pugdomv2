// Renders the Google Play store graphics into store/google-play/ from the pug mark.
//   yarn store-graphics            (writes to store/google-play/)
//   yarn store-graphics some/dir   (writes elsewhere, e.g. to preview)
// Play wants a 512×512 icon and a 1024×500 feature graphic without transparency (saved as JPEG by `sips`, which
// ships with macOS). Text uses the app's fonts: Fraunces for the wordmark, Nunito for the tagline.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Resvg } = require('@resvg/resvg-js');
const { pugMark, svg, GROUND } = require('./pugDrawing');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'store', 'google-play'));
fs.mkdirSync(OUT, { recursive: true });

const font = file => require.resolve(`@expo-google-fonts/${file}`);
const FONTS = [font('fraunces/700Bold/Fraunces_700Bold.ttf'), font('nunito/700Bold/Nunito_700Bold.ttf')];

// Apricot coat, light mode (coats.ts): the app's default look
const INK = '#2B1B18';
const ACCENT_TEXT = '#A4521A';
const GLOW = '#F3C9A1';

const TAGLINES = {
    'pt-BR': 'Um app de Mastodon caloroso',
    en: 'A warm Mastodon app',
};

const featureGraphic = tagline => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
    <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${GROUND.light}"/>
            <stop offset="1" stop-color="#F7E2CF"/>
        </linearGradient>
    </defs>
    <rect width="1024" height="500" fill="url(#ground)"/>
    <circle cx="280" cy="250" r="190" fill="${GLOW}" opacity="0.5"/>
    <svg x="110" y="80" width="340" height="340" viewBox="6 6 52 52">${pugMark({ id: 'fg' })}</svg>
    <text x="500" y="258" font-family="Fraunces" font-weight="700" font-size="100" fill="${INK}">pugdon</text>
    <text x="505" y="306" font-family="Nunito" font-weight="700" font-size="28" fill="${ACCENT_TEXT}">${tagline}</text>
</svg>`;

const render = (source, file) => {
    const png = new Resvg(source, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Nunito' } }).render().asPng();
    fs.writeFileSync(path.join(OUT, file), png);
    return path.join(OUT, file);
};

// Full-bleed, like the app icon: Play rounds the corners itself
const icon = render(svg({ size: 512, box: 350, ground: GROUND.light, body: pugMark({ id: 'ic' }) }), 'icon-512.png');
console.log(path.relative(process.cwd(), icon));

for (const [language, tagline] of Object.entries(TAGLINES)) {
    const png = render(featureGraphic(tagline), `feature-graphic-${language}.png`);
    const jpeg = png.replace(/\.png$/, '.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', png, '--out', jpeg], { stdio: 'ignore' });
    fs.unlinkSync(png);
    console.log(path.relative(process.cwd(), jpeg));
}

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

const { pugMark, pugStencil, svg, GROUND } = require('./pugDrawing');

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

import fs from 'fs';
import path from 'path';

// Screens and components read colors from the theme (useTheme / useThemedStyles),
// or from services/theme/media.ts for controls drawn over photos and video
const ROOTS = ['components', 'screens'];
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
    });

describe('color literals', () => {
    const root = path.resolve(__dirname, '..');

    it('finds the source files it guards', () => {
        expect(ROOTS.flatMap(dir => sourceFiles(path.join(root, dir))).length).toBeGreaterThan(20);
    });

    it('keeps hex, rgb() and hsl() colors out of components/ and screens/', () => {
        const offenders = ROOTS.flatMap(dir => sourceFiles(path.join(root, dir))).flatMap(file =>
            fs.readFileSync(file, 'utf8').split('\n').flatMap((line, index) =>
                (line.match(COLOR_LITERAL) ?? []).map(match => `${path.relative(root, file)}:${index + 1} ${match}`)
            )
        );
        expect(offenders).toEqual([]);
    });
});

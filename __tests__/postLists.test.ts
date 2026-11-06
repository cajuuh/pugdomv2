import fs from 'fs';
import path from 'path';

// A post's text is selectable, so every list of posts needs postListProps (see services/media/autoplay.ts)
describe('lists of posts', () => {
    const screens = path.join(__dirname, '..', 'screens');
    const files = (fs.readdirSync(screens, { recursive: true }) as string[]).filter(file => file.endsWith('.tsx'));

    it.each(files.filter(file => {
        const source = fs.readFileSync(path.join(screens, file), 'utf8');
        return /<FlashList\b/.test(source) && source.includes('<TootCard');
    }))('%s spreads postListProps', file => {
        const source = fs.readFileSync(path.join(screens, file), 'utf8');
        expect(source).toContain('{...postListProps}');
    });
});

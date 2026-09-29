import { buildType, fontAssets, fontFamilies } from '../services/theme/typography';

describe('type scale', () => {
    it('uses one loaded family per weight and no fontWeight once fonts are loaded', () => {
        const type = buildType(true);
        for (const style of Object.values(type)) {
            expect(Object.keys(fontAssets)).toContain(style.fontFamily);
            expect(style).not.toHaveProperty('fontWeight');
        }
        expect(type.title).toMatchObject({ fontFamily: fontFamilies.display, fontSize: 30 });
        expect(type.sheetTitle).toMatchObject({ fontFamily: fontFamilies.display, fontSize: 19 });
        expect(type.name).toMatchObject({ fontFamily: fontFamilies.extraBold, fontSize: 15 });
        expect(type.body).toMatchObject({ fontFamily: fontFamilies.regular, fontSize: 15.5, lineHeight: 22.5 });
        expect(type.label).toMatchObject({ fontFamily: fontFamilies.extraBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.96 });
        expect(type.meta).toMatchObject({ fontFamily: fontFamilies.semiBold, fontSize: 12.5 });
    });

    it('falls back to the system font at the same weight when fonts are not loaded', () => {
        const type = buildType(false);
        for (const style of Object.values(type)) {
            expect(style).not.toHaveProperty('fontFamily');
        }
        expect(type.title.fontWeight).toBe('700');
        expect(type.body.fontWeight).toBe('400');
        expect(type.label.fontWeight).toBe('800');
        expect(type.meta.fontWeight).toBe('600');
    });

    it('only bundles the weights the scale uses', () => {
        expect(Object.keys(fontAssets).sort()).toEqual(Object.values(fontFamilies).sort());
    });
});

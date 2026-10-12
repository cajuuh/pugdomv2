import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { isSupporterRole, roleTextColor, RoleBadge } from '../components/ui/roleBadge';
import { PugMark } from '../components/ui/pugMark';
import { COATS, buildColors } from '../services/theme/coats';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

describe('isSupporterRole', () => {
    it.each(['Server supporter', 'Supporter', 'Apoiador', 'Apoiadora do servidor', 'Patron', 'Donor', 'Sponsor'])('counts "%s" as a supporter', name => {
        expect(isSupporterRole(name)).toBe(true);
    });

    it.each(['Admin', 'Moderator', 'Owner', 'Bot'])('leaves "%s" a plain role', name => {
        expect(isSupporterRole(name)).toBe(false);
    });
});

describe('roleTextColor', () => {
    it("keeps the role's colour when it reads well, in every coat", () => {
        for (const coat of COATS) {
            for (const dark of [false, true]) {
                const { inputBackground, accentText } = buildColors(coat.key, dark, true);
                const readable = dark ? '#FFD966' : '#7A1F1F';
                expect(roleTextColor(readable, inputBackground, accentText)).toBe(readable);
            }
        }
    });

    it("falls back to the coat's colour when the role's would be hard to read, or there's none", () => {
        const { inputBackground, accentText } = buildColors('apricot', false, true);
        expect(roleTextColor('#FFF8E0', inputBackground, accentText)).toBe(accentText);
        expect(roleTextColor('', inputBackground, accentText)).toBe(accentText);
        expect(roleTextColor('red', inputBackground, accentText)).toBe(accentText);
        expect(roleTextColor(undefined, inputBackground, accentText)).toBe(accentText);
    });
});

describe('RoleBadge', () => {
    it('shows a happy pug for supporters', async () => {
        await render(<RoleBadge role={{ id: '1', name: 'Server supporter', color: '' }} />);

        expect(screen.getByLabelText('Role: Server supporter')).toBeTruthy();
        expect(screen.getByTestId('pug-happy-eye', { includeHiddenElements: true })).toBeTruthy();
    });

    it('is a plain badge for other roles', async () => {
        await render(<RoleBadge role={{ id: '2', name: 'Admin', color: '#7A1F1F' }} />);

        expect(screen.getByLabelText('Role: Admin')).toBeTruthy();
        expect(screen.queryByTestId('pug-happy-eye', { includeHiddenElements: true })).toBeNull();
    });
});

describe('PugMark', () => {
    // The author's pug is missing an eye: every drawing keeps it as a flat closed line on our right
    it.each([undefined, 'happy'] as const)('keeps the closed eye (mood %s)', async mood => {
        const { toJSON } = await render(<PugMark coat="apricot" size={64} mood={mood} />);
        expect(JSON.stringify(toJSON())).toContain('"x1":"39.9"');
    });
});

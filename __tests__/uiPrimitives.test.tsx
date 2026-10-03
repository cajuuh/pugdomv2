import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Avatar, Card, IconButton, PillButton, PugMark, SectionLabel, SegmentedPill, ThemedSwitch, Well } from '../components/ui';
import { initialsOf } from '../components/ui/avatar';
import { mockTheme } from '../testUtils/theme';

let mockIsDark = false;
jest.mock('../services/themeContext', () => ({
    useTheme: () => ({ ...jest.requireActual('../testUtils/theme').mockTheme, isDark: mockIsDark }),
}));

const { colors } = mockTheme;
const styleOf = (element: any) => StyleSheet.flatten(element.props.style);

beforeEach(() => {
    mockIsDark = false;
});

describe('SegmentedPill', () => {
    const options = [
        { value: 'home', label: 'Home' },
        { value: 'local', label: 'Local' },
    ] as const;

    it('renders tabs with the selected one marked, and reports presses', async () => {
        const onChange = jest.fn();
        await render(<SegmentedPill options={[...options]} value="home" onChange={onChange} />);

        expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
        expect(screen.getByRole('tab', { name: 'Local' })).not.toBeSelected();
        expect(styleOf(screen.getByRole('tab', { name: 'Home' })).backgroundColor).toBe(colors.cardBackground);

        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
        expect(onChange).toHaveBeenCalledWith('local');
    });

    it('renders chips with an accent fill on the active one', async () => {
        await render(<SegmentedPill variant="chips" options={[...options]} value="local" onChange={jest.fn()} />);

        const active = screen.getByRole('button', { name: 'Local' });
        expect(active).toBeSelected();
        expect(styleOf(active).backgroundColor).toBe(colors.accentColor);
        expect(screen.getByRole('button', { name: 'Home' })).not.toBeSelected();
    });
});

describe('PillButton', () => {
    it('uses the accent fill and on-accent ink for primary', async () => {
        const onPress = jest.fn();
        await render(<PillButton label="Vote" onPress={onPress} />);

        const button = screen.getByRole('button', { name: 'Vote' });
        expect(styleOf(button).backgroundColor).toBe(colors.accentColor);
        expect(StyleSheet.flatten(screen.getByText('Vote').props.style).color).toBe(colors.buttonTextColor);
        await fireEvent.press(button);
        expect(onPress).toHaveBeenCalled();
    });

    it('reaches a 44pt touch target at the small size', async () => {
        await render(<PillButton label="Follow" size="small" onPress={jest.fn()} />);
        const button = screen.getByRole('button', { name: 'Follow' });
        expect(styleOf(button).height + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
    });

    it.each([
        ['disabled', { disabled: true }],
        ['loading', { loading: true }],
    ])('ignores presses while %s', async (_state, props) => {
        const onPress = jest.fn();
        await render(<PillButton label="Post" onPress={onPress} {...props} />);

        const button = screen.getByRole('button', { name: 'Post' });
        expect(button).toBeDisabled();
        await fireEvent.press(button);
        expect(onPress).not.toHaveBeenCalled();
    });
});

describe('IconButton', () => {
    it('has a label and at least a 44pt hit area', async () => {
        const onPress = jest.fn();
        await render(<IconButton icon="heart-outline" accessibilityLabel="Favourite" selected onPress={onPress} />);

        const button = screen.getByRole('button', { name: 'Favourite' });
        expect(button).toBeSelected();
        expect(styleOf(button)).toMatchObject({ minWidth: 44, minHeight: 44 });
        await fireEvent.press(button);
        expect(onPress).toHaveBeenCalled();
    });
});

describe('Avatar', () => {
    it('falls back to initials without an image', async () => {
        await render(<Avatar name="Pug Dom" />);
        expect(screen.getByRole('image', { name: 'Pug Dom' })).toBeTruthy();
        expect(screen.getByText('PD')).toBeTruthy();
    });

    it('falls back to initials when the image fails to load', async () => {
        await render(<Avatar name="alice" uri="https://example.social/a.png" />);
        expect(screen.queryByText('A')).toBeNull();

        await fireEvent(screen.getByTestId('avatar-image'), 'error');
        expect(screen.getByText('A')).toBeTruthy();
    });

    it('shows a badge when given one', async () => {
        await render(<Avatar name="bob" badge="heart" />);
        expect(styleOf(screen.getByTestId('avatar-badge')).backgroundColor).toBe(colors.accentColor);
    });

    it('builds initials from up to two words', () => {
        expect(initialsOf('  mary  jane watson ')).toBe('MJ');
        expect(initialsOf('')).toBe('?');
    });
});

describe('Well and Card', () => {
    it('Well is a sunken panel', async () => {
        await render(<Well testID="well"><Text>poll</Text></Well>);
        expect(styleOf(screen.getByTestId('well'))).toMatchObject({ backgroundColor: colors.inputBackground, borderRadius: 16 });
    });

    it('Card has a shadow in light mode only', async () => {
        await render(<Card testID="card" />);
        expect(styleOf(screen.getByTestId('card'))).toMatchObject({ backgroundColor: colors.cardBackground, borderRadius: 20, shadowOpacity: 0.06 });

        mockIsDark = true;
        await screen.rerender(<Card testID="card" />);
        expect(styleOf(screen.getByTestId('card')).shadowOpacity).toBeUndefined();
    });
});

describe('ThemedSwitch and SectionLabel', () => {
    it('ThemedSwitch uses the accent track when on', async () => {
        await render(<ThemedSwitch value onValueChange={jest.fn()} accessibilityLabel="Tint" />);
        const toggle = screen.getByRole('switch', { name: 'Tint' });
        expect(toggle).toBeChecked();
        expect(toggle.props.onTintColor).toBe(colors.accentColor);
    });

    it('SectionLabel is a muted caps header', async () => {
        await render(<SectionLabel>Appearance</SectionLabel>);
        const label = screen.getByRole('header', { name: 'Appearance' });
        expect(StyleSheet.flatten(label.props.style)).toMatchObject({ color: colors.textMuted, textTransform: 'uppercase' });
    });
});

describe('PugMark', () => {
    const hasWrinkle = () => JSON.stringify(screen.toJSON()).includes('q 1.45');

    it('draws the forehead wrinkle only when there is room for it', async () => {
        await render(<PugMark coat="apricot" size={36} />);
        expect(hasWrinkle()).toBe(true);

        await render(<PugMark coat="apricot" size={22} />);
        expect(hasWrinkle()).toBe(false);
    });

    it('gives each mark its own gradient ids', async () => {
        await render(<><PugMark coat="apricot" /><PugMark coat="plum" /></>);
        const ids = JSON.stringify(screen.toJSON()).match(/"name":"pug[a-zA-Z0-9]+face"/g) ?? [];
        expect(new Set(ids).size).toBe(2);
    });
});

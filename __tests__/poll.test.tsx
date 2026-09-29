import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Poll, pollTimeLeft } from '../components/Poll/poll';
import { votePoll } from '../services/mastodon/polls';
import { Poll as PollType } from '../services/mastodon/types';
import { mockTheme } from '../testUtils/theme';

jest.mock('../services/mastodon/polls', () => ({ votePoll: jest.fn() }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const mockedVote = votePoll as jest.MockedFunction<typeof votePoll>;
const { colors } = mockTheme;
const HOUR = 60 * 60 * 1000;

const makePoll = (overrides: Partial<PollType> = {}): PollType => ({
    id: 'p1',
    expires_at: new Date(Date.now() + 18 * HOUR + 60000).toISOString(),
    expired: false,
    multiple: false,
    votes_count: 214,
    voters_count: 214,
    voted: false,
    own_votes: [],
    options: [
        { title: 'On the sofa', votes_count: 51 },
        { title: 'On your laptop', votes_count: 26 },
        { title: 'In a sunbeam', votes_count: 137 },
    ],
    emojis: [],
    ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('Poll voting', () => {
    it('shows radios, enables Vote once one is picked, and submits it', async () => {
        const voted = makePoll({ voted: true, own_votes: [2] });
        mockedVote.mockResolvedValue(voted);
        await render(<Poll initialPoll={makePoll()} />);

        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(screen.getByText('214 votes · 18h left')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Vote' })).toBeDisabled();

        await fireEvent.press(screen.getByRole('radio', { name: 'In a sunbeam' }));
        expect(screen.getByRole('radio', { name: 'In a sunbeam' })).toBeChecked();
        expect(StyleSheet.flatten(screen.getByRole('radio', { name: 'In a sunbeam' }).props.style)).toMatchObject({
            borderColor: colors.accentColor,
            backgroundColor: colors.accentSoft,
        });

        // Single choice: picking another replaces it
        await fireEvent.press(screen.getByRole('radio', { name: 'On the sofa' }));
        expect(screen.getByRole('radio', { name: 'In a sunbeam' })).not.toBeChecked();
        await fireEvent.press(screen.getByRole('radio', { name: 'In a sunbeam' }));

        await fireEvent.press(screen.getByRole('button', { name: 'Vote' }));
        expect(mockedVote).toHaveBeenCalledWith('p1', { choices: [2] });
        expect(screen.getByLabelText('In a sunbeam, 64 percent, your vote')).toBeTruthy();
    });

    it('uses checkboxes for multiple-choice polls', async () => {
        await render(<Poll initialPoll={makePoll({ multiple: true })} />);

        await fireEvent.press(screen.getByRole('checkbox', { name: 'On the sofa' }));
        await fireEvent.press(screen.getByRole('checkbox', { name: 'In a sunbeam' }));

        expect(screen.getByRole('checkbox', { name: 'On the sofa' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'In a sunbeam' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'On your laptop' })).not.toBeChecked();
    });
});

describe('Poll results', () => {
    it('highlights the winner and marks your own vote', async () => {
        await render(<Poll initialPoll={makePoll({ voted: true, own_votes: [1] })} />);

        expect(screen.queryByRole('radio')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull();
        expect(screen.getByLabelText('On your laptop, 12 percent, your vote')).toBeTruthy();
        expect(screen.getByLabelText('On the sofa, 24 percent')).toBeTruthy();

        // The first child of a result row is its bar
        const [winnerBar] = screen.getByLabelText('In a sunbeam, 64 percent').children as any[];
        expect(StyleSheet.flatten(winnerBar.props.style)).toMatchObject({ backgroundColor: colors.accentColor, width: '64%' });
        const [otherBar] = screen.getByLabelText('On the sofa, 24 percent').children as any[];
        expect(StyleSheet.flatten(otherBar.props.style)).toMatchObject({ backgroundColor: colors.accentSoft, width: '24%' });
    });

    it('says Closed once the poll has ended', async () => {
        await render(<Poll initialPoll={makePoll({ expired: true })} />);
        expect(screen.getByText('214 votes · Closed')).toBeTruthy();
    });
});

describe('pollTimeLeft', () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    const at = (ms: number) => new Date(now + ms).toISOString();

    it('rounds down to minutes, hours or days', () => {
        expect(pollTimeLeft({ expired: false, expires_at: at(5 * 60000 + 1) }, now)).toBe('5m left');
        expect(pollTimeLeft({ expired: false, expires_at: at(18 * HOUR + 1) }, now)).toBe('18h left');
        expect(pollTimeLeft({ expired: false, expires_at: at(3 * 24 * HOUR + 1) }, now)).toBe('3d left');
    });

    it('reports ended polls as closed and polls without an end as open', () => {
        expect(pollTimeLeft({ expired: true, expires_at: at(HOUR) }, now)).toBe('Closed');
        expect(pollTimeLeft({ expired: false, expires_at: at(-1000) }, now)).toBe('Closed');
        expect(pollTimeLeft({ expired: false, expires_at: null }, now)).toBeNull();
    });
});

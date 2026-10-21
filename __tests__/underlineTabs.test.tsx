import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SegmentedPill } from '../components/ui';

jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));

const tabs = ['Pinned', 'Posts', 'Replies', 'Media', 'Bookmarks'].map(label => ({ value: label.toLowerCase(), label }));

describe('Underline tabs', () => {
    it('keeps every tab reachable in a row that scrolls sideways', async () => {
        await render(<SegmentedPill variant="underline" options={tabs} value="posts" onChange={jest.fn()} />);

        const row = screen.getByTestId('underline-tabs');
        expect(row.props.horizontal).toBe(true);
        expect(screen.getAllByRole('tab').map(tab => tab.props.accessibilityLabel)).toEqual(['Pinned', 'Posts', 'Replies', 'Media', 'Bookmarks']);
    });

    it('scrolls a chosen tab past the edge into view', async () => {
        const scrollTo = jest.spyOn(ScrollView.prototype as any, 'scrollTo').mockImplementation(() => {});
        const { rerender } = await render(<SegmentedPill variant="underline" options={tabs} value="posts" onChange={jest.fn()} />);
        // A 300pt-wide row; Media starts at 330 and is 60 wide, past the edge
        await fireEvent(screen.getByTestId('underline-tabs'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } } });
        const media = screen.getByRole('tab', { name: 'Media' });
        await fireEvent(media, 'layout', { nativeEvent: { layout: { x: 330, y: 0, width: 60, height: 44 } } });

        await rerender(<SegmentedPill variant="underline" options={tabs} value="media" onChange={jest.fn()} />);

        expect(scrollTo).toHaveBeenCalledWith({ x: 330 + 60 - 300 + 20 });
        scrollTo.mockRestore();
    });

    it('shows there are more tabs past the edge, and goes to them', async () => {
        const scrollToEnd = jest.spyOn(ScrollView.prototype as any, 'scrollToEnd').mockImplementation(() => {});
        await render(<SegmentedPill variant="underline" options={tabs} value="posts" onChange={jest.fn()} />);
        const row = screen.getByTestId('underline-tabs');
        await fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } } });
        await fireEvent(row, 'contentSizeChange', 520, 44);

        expect(screen.queryByRole('button', { name: 'Earlier tabs' })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'More tabs' }));
        expect(scrollToEnd).toHaveBeenCalled();

        // At the end the arrow turns around
        await fireEvent.scroll(row, { nativeEvent: { contentOffset: { x: 220, y: 0 } } });
        expect(screen.queryByRole('button', { name: 'More tabs' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Earlier tabs' })).toBeTruthy();
        scrollToEnd.mockRestore();
    });

    it('shows no arrows when every tab fits', async () => {
        await render(<SegmentedPill variant="underline" options={tabs.slice(0, 3)} value="posts" onChange={jest.fn()} />);
        const row = screen.getByTestId('underline-tabs');
        await fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 44 } } });
        await fireEvent(row, 'contentSizeChange', 320, 44);
        expect(screen.queryByRole('button', { name: 'More tabs' })).toBeNull();
    });
});

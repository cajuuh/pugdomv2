import React from 'react';
import { Alert, View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { DialogHost, stackButtons } from '../components/Dialog/dialogHost';
import { dialog, dismissDialog, getDialogState, TOAST_DURATION_MS } from '../services/dialog';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('without a host', () => {
    it('falls back to the system alert, with exactly the same arguments', () => {
        dialog.alert('Session expired', 'Log in again');
        dialog.toast('Muted');

        expect(Alert.alert).toHaveBeenNthCalledWith(1, 'Session expired', 'Log in again');
        expect(Alert.alert).toHaveBeenNthCalledWith(2, 'Muted');
    });
});

describe('Dialog', () => {
    it('shows a themed dialog and runs the pressed button', async () => {
        const onDelete = jest.fn();
        const onCancel = jest.fn();
        await render(<DialogHost />);

        await act(async () =>
            dialog.alert('Delete this post?', "This can't be undone.", [
                { text: 'Cancel', style: 'cancel', onPress: onCancel },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
            ])
        );

        const box = screen.getByTestId('dialog');
        expect(within(box).getByRole('header', { name: 'Delete this post?' })).toBeTruthy();
        expect(within(box).getByText("This can't be undone.")).toBeTruthy();
        expect(Alert.alert).not.toHaveBeenCalled();
        await fireEvent.press(within(box).getByRole('button', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
        expect(screen.queryByTestId('dialog')).toBeNull();
    });

    it('offers OK when given no buttons', async () => {
        await render(<DialogHost />);
        await act(async () => dialog.alert('Camera access'));

        await fireEvent.press(within(screen.getByTestId('dialog')).getByRole('button', { name: 'OK' }));
        expect(screen.queryByTestId('dialog')).toBeNull();
    });

    it('cancels on back or a tap outside, but only when there is a way to cancel', async () => {
        const onCancel = jest.fn();
        const onDismiss = jest.fn();
        await render(<DialogHost />);

        await act(async () => dialog.alert('Discard?', undefined, [{ text: 'Keep', style: 'cancel', onPress: onCancel }, { text: 'Discard', style: 'destructive' }]));
        await act(async () => dismissDialog(getDialogState().dialogs[0].id));
        expect(onCancel).toHaveBeenCalled();

        await act(async () => dialog.alert('Pick one', undefined, [{ text: 'A' }, { text: 'B' }]));
        await act(async () => dismissDialog(getDialogState().dialogs[0].id));
        expect(screen.getByTestId('dialog')).toBeTruthy();
        await fireEvent.press(within(screen.getByTestId('dialog')).getByRole('button', { name: 'A' }));

        await act(async () => dialog.alert('Swipe', undefined, [{ text: 'Keep', style: 'cancel' }, { text: 'Go' }], { onDismiss, cancelable: true }));
        await act(async () => dismissDialog(getDialogState().dialogs[0].id));
        expect(screen.queryByTestId('dialog')).toBeNull();
    });

    it('shows dialogs one at a time, in order', async () => {
        await render(<DialogHost />);
        await act(async () => {
            dialog.alert('First');
            dialog.alert('Second');
        });

        expect(screen.getByText('First')).toBeTruthy();
        expect(screen.queryByText('Second')).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
        expect(screen.getByText('Second')).toBeTruthy();
    });

    it('draws in the topmost open host, like a sheet over the app', async () => {
        const { rerender } = await render(
            <>
                <View testID="app"><DialogHost /></View>
                <View testID="sheet"><DialogHost active /></View>
            </>
        );
        await act(async () => dialog.alert('Over the sheet'));
        expect(within(screen.getByTestId('sheet')).getByText('Over the sheet')).toBeTruthy();

        // The sheet closes: the dialog moves down to the app
        await rerender(
            <>
                <View testID="app"><DialogHost /></View>
                <View testID="sheet"><DialogHost active={false} /></View>
            </>
        );
        expect(within(screen.getByTestId('app')).getByText('Over the sheet')).toBeTruthy();
        expect(within(screen.getByTestId('sheet')).queryByText('Over the sheet')).toBeNull();
    });
});

describe('Subtitles', () => {
    it('puts names and handles on their own line, in the text font', async () => {
        await render(<DialogHost />);
        await act(async () => dialog.alert('Block this account?', 'They won’t see your posts.', [{ text: 'Block', style: 'destructive' }], { subtitle: '@ana@art.social' }));

        const box = screen.getByTestId('dialog');
        expect(within(box).getByRole('header', { name: 'Block this account?' })).toBeTruthy();
        expect(within(box).getByText('@ana@art.social')).toBeTruthy();
    });

    it('leads the message with it when falling back to the system alert', () => {
        dialog.alert('Unfollow?', undefined, [{ text: 'Unfollow' }], { subtitle: 'Ana' });
        expect(Alert.alert).toHaveBeenCalledWith('Unfollow?', 'Ana', [{ text: 'Unfollow' }], {});
    });
});

describe('Toast', () => {
    it('shows briefly, then goes away by itself', async () => {
        jest.useFakeTimers();
        try {
            await render(<DialogHost />);
            await act(async () => dialog.toast('You muted @ana'));

            expect(screen.getByTestId('toast')).toBeTruthy();
            expect(screen.getByText('You muted @ana')).toBeTruthy();
            await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS));
            expect(screen.queryByTestId('toast')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('stackButtons', () => {
    it('keeps two buttons side by side when they fit the screen, and stacks them when they don’t', () => {
        // pt-BR discard dialog: fits a 411dp phone, not a 360dp one
        expect(stackButtons(['Continuar editando', 'Descartar'], 411)).toBe(false);
        expect(stackButtons(['Continuar editando', 'Descartar'], 360)).toBe(true);
        expect(stackButtons(['Cancel', 'Delete'], 360)).toBe(false);
        expect(stackButtons(['One', 'Two', 'Three'], 800)).toBe(true);
    });
});

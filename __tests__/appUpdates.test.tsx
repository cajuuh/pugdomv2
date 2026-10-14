import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { useAppUpdates } from '../hooks/useAppUpdates';
import { dialog } from '../services/dialog';

jest.mock('expo-updates', () => ({
    __esModule: true,
    isEnabled: true,
    useUpdates: jest.fn(),
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
    reloadAsync: jest.fn(),
}));

const mocked = Updates as jest.Mocked<typeof Updates>;
let appStateListener: ((state: AppStateStatus) => void) | undefined;

beforeEach(() => {
    jest.clearAllMocks();
    mocked.useUpdates.mockReturnValue({ isUpdatePending: false } as any);
    mocked.reloadAsync.mockResolvedValue();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        appStateListener = listener as (state: AppStateStatus) => void;
        return { remove: jest.fn() } as any;
    });
});
afterEach(() => jest.restoreAllMocks());

describe('useAppUpdates', () => {
    it('checks for an update when the app comes back, and downloads it', async () => {
        mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as any);
        mocked.fetchUpdateAsync.mockResolvedValue({} as any);
        await renderHook(() => useAppUpdates());

        await act(async () => appStateListener?.('background'));
        expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();

        await act(async () => appStateListener?.('active'));
        expect(mocked.checkForUpdateAsync).toHaveBeenCalled();
        expect(mocked.fetchUpdateAsync).toHaveBeenCalled();
    });

    it("doesn't download when there's nothing new", async () => {
        mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as any);
        await renderHook(() => useAppUpdates());
        await act(async () => appStateListener?.('active'));
        expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
    });

    it('offers to restart once an update is downloaded', async () => {
        const alert = jest.spyOn(dialog, 'alert').mockImplementation(() => {});
        mocked.useUpdates.mockReturnValue({ isUpdatePending: true, downloadedUpdate: { updateId: 'u1' } } as any);
        await renderHook(() => useAppUpdates());

        expect(alert).toHaveBeenCalledWith('Update ready', 'Restart pugdon to use the latest version.', expect.any(Array));
        const buttons = alert.mock.calls[0][2]!;
        expect(buttons.map(button => button.text)).toEqual(['Later', 'Restart']);
        buttons[1].onPress?.();
        expect(mocked.reloadAsync).toHaveBeenCalled();
    });
});

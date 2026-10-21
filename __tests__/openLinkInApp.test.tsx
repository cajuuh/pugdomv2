import { act, renderHook } from '@testing-library/react-native';
import { useOpenAccount } from '../hooks/useOpenAccount';
import { resolveStatus } from '../services/mastodon/search';
import { dialog } from '../services/dialog';

const mockPush = jest.fn();
jest.mock('../services/navigationContext', () => ({ useNavigator: () => ({ push: mockPush }) }));
jest.mock('../services/mastodon/search', () => ({
    ...jest.requireActual('../services/mastodon/search'),
    resolveStatus: jest.fn(),
    resolveAccount: jest.fn(),
}));
jest.mock('../components/TootCard/htmlContent', () => ({ openLink: jest.fn() }));

describe('Opening a post from another server', () => {
    it('says it is opening, and ignores taps while the lookup is on its way', async () => {
        let finish: (status: unknown) => void = () => {};
        (resolveStatus as jest.Mock).mockReturnValueOnce(new Promise(resolve => (finish = resolve)));
        const toast = jest.spyOn(dialog, 'toast');
        const { result } = await renderHook(() => useOpenAccount());

        let first: Promise<void> = Promise.resolve();
        await act(async () => {
            first = result.current.openLinkInApp('https://mas.to/@ana/111');
            // A second and third tap while our server is still fetching it
            await result.current.openLinkInApp('https://mas.to/@ana/111');
            await result.current.openLinkInApp('https://mas.to/@ana/111');
        });
        expect(toast).toHaveBeenCalledWith('Opening post…', expect.any(Promise));
        expect(resolveStatus).toHaveBeenCalledTimes(1);

        await act(async () => {
            finish({ id: '42' });
            await first;
        });
        expect(mockPush).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith({ name: 'thread', statusId: '42' });
    });
});

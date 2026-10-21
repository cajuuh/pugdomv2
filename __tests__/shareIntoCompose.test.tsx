import { Image } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ResolvedSharePayload } from 'expo-sharing';
import { sharedContent } from '../services/sharedContent';
import { useShareIntoCompose } from '../hooks/useShareIntoCompose';

const mockShare = { resolvedSharedPayloads: [] as ResolvedSharePayload[], clearSharedPayloads: jest.fn() };
jest.mock('expo-sharing', () => ({ useIncomingShare: () => mockShare }));
const mockOpenCompose = jest.fn();
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: mockOpenCompose }) }));

const payload = (extra: Partial<ResolvedSharePayload>): ResolvedSharePayload =>
    ({ value: '', shareType: 'text', contentUri: null, contentType: null, contentMimeType: null, originalName: null, contentSize: null, ...extra }) as ResolvedSharePayload;

beforeEach(() => {
    jest.clearAllMocks();
    mockShare.resolvedSharedPayloads = [];
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => success(1200, 800));
});

describe('sharedContent', () => {
    it('turns text and links into the words, pictures and a video into media', async () => {
        const shared = await sharedContent([
            payload({ shareType: 'text', value: ' Look at this ' }),
            payload({ shareType: 'url', value: 'https://example.com/a' }),
            payload({ shareType: 'image', value: 'content://a', contentUri: 'file:///a.jpg', contentMimeType: 'image/jpeg', originalName: 'a.jpg', contentSize: 10 }),
            payload({ shareType: 'video', value: 'content://v', contentUri: 'file:///v.mp4', contentMimeType: 'video/mp4' }),
        ]);

        expect(shared.text).toBe('Look at this\nhttps://example.com/a');
        expect(shared.media).toEqual([
            { uri: 'file:///a.jpg', width: 1200, height: 800, mimeType: 'image/jpeg', fileName: 'a.jpg', fileSize: 10, type: 'image' },
            { uri: 'file:///v.mp4', width: 0, height: 0, mimeType: 'video/mp4', fileName: null, fileSize: null, type: 'video' },
        ]);
    });
});

describe('useShareIntoCompose', () => {
    it('starts a post with what was shared once signed in, and only once', async () => {
        mockShare.resolvedSharedPayloads = [payload({ shareType: 'url', value: 'https://example.com' })];
        const { rerender } = await renderHook(({ signedIn }: { signedIn: boolean }) => useShareIntoCompose(signedIn), { initialProps: { signedIn: false } });
        expect(mockOpenCompose).not.toHaveBeenCalled();

        await rerender({ signedIn: true });
        await waitFor(() => expect(mockOpenCompose).toHaveBeenCalledWith({ shared: { text: 'https://example.com', media: [] } }));
        expect(mockShare.clearSharedPayloads).toHaveBeenCalled();

        await rerender({ signedIn: true });
        expect(mockOpenCompose).toHaveBeenCalledTimes(1);
    });
});

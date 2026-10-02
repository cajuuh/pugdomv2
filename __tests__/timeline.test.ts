import { scrollListToTop } from '../screens/Timeline/timeline';

describe('scrollListToTop', () => {
    it('scrolls to the first post by index before settling on the very top', async () => {
        const calls: string[] = [];
        let finishIndexScroll = () => {};
        const list = {
            // FlashList resolves once the index scroll (and its measuring) is done
            scrollToIndex: jest.fn(() => {
                calls.push('index');
                return new Promise<void>(resolve => {
                    finishIndexScroll = resolve;
                });
            }),
            scrollToOffset: jest.fn(() => {
                calls.push('offset');
            }),
        };

        const done = scrollListToTop(list);
        expect(list.scrollToIndex).toHaveBeenCalledWith({ index: 0, animated: true });
        // A plain animated scrollToOffset(0) is what stopped short: it must wait for the index scroll
        expect(list.scrollToOffset).not.toHaveBeenCalled();

        finishIndexScroll();
        await done;

        expect(list.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
        expect(calls).toEqual(['index', 'offset']);
    });

    it('does nothing before the list is mounted', async () => {
        await expect(scrollListToTop(null)).resolves.toBeUndefined();
    });
});

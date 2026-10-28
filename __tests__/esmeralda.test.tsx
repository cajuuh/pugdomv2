import { act, renderHook } from '@testing-library/react-native';
import { TAPS_TO_OPEN, useEsmeraldaTaps } from '../screens/Settings/esmeralda';

describe('Esmeralda easter egg', () => {
    let now = 0;
    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => jest.restoreAllMocks());

    const tapTimes = async (tap: () => void, times: number, gapMs: number) => {
        for (let i = 0; i < times; i++) {
            now += gapMs;
            await act(async () => tap());
        }
    };

    it(`opens on the ${TAPS_TO_OPEN}th quick tap, and closes`, async () => {
        const { result } = await renderHook(() => useEsmeraldaTaps());
        await tapTimes(result.current.tap, TAPS_TO_OPEN - 1, 300);
        expect(result.current.open).toBe(false);

        await tapTimes(result.current.tap, 1, 300);
        expect(result.current.open).toBe(true);

        await act(async () => result.current.close());
        expect(result.current.open).toBe(false);
    });

    it('starts counting again after a pause', async () => {
        const { result } = await renderHook(() => useEsmeraldaTaps());
        await tapTimes(result.current.tap, TAPS_TO_OPEN - 1, 300);
        await tapTimes(result.current.tap, 1, 1500);
        expect(result.current.open).toBe(false);

        await tapTimes(result.current.tap, TAPS_TO_OPEN - 1, 300);
        expect(result.current.open).toBe(true);
    });
});

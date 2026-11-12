import { postTime, setAbsoluteDates } from '../services/dates';
import { createTranslator } from '../services/i18n/translate';
import { notificationTime } from '../screens/Notifications/rows';

const pt = createTranslator('pt-BR');
const en = createTranslator('en');
// Local times, so the day and the hour don't move with the machine's time zone
const now = new Date(2026, 10, 12, 15, 0);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

afterEach(() => setAbsoluteDates(false));

describe('Post dates', () => {
    it('are relative for the past week', () => {
        expect(postTime(ago(0), pt, now)).toBe('agora');
        expect(postTime(ago(4), pt, now)).toBe('4min');
        expect(postTime(ago(3 * 60), pt, now)).toBe('3h');
        expect(postTime(ago(6 * 24 * 60), pt, now)).toBe('6d');
    });

    it('show the date after a week, and the year when it is not this one', () => {
        expect(postTime(new Date(2026, 1, 3, 9, 0).toISOString(), en, now)).toBe('Feb 3');
        expect(postTime(new Date(2025, 10, 12, 9, 0).toISOString(), en, now)).toBe('Nov 12, 2025');
        expect(postTime(new Date(2026, 1, 3, 9, 0).toISOString(), pt, now)).toMatch(/^3 de fev/);
    });

    it('always show the date and time when absolute dates are on', () => {
        setAbsoluteDates(true);
        expect(postTime(ago(4), en, now)).toBe('Nov 12, 02:56 PM');
        expect(postTime(new Date(2025, 10, 12, 9, 5).toISOString(), pt, now)).toBe('12 de nov. de 2025, 09:05');
    });
});

describe('Notification dates', () => {
    it('follow absolute dates too', () => {
        expect(notificationTime(ago(4), now, en)).toBe('4m');
        setAbsoluteDates(true);
        expect(notificationTime(ago(4), now, en)).toBe('Nov 12, 02:56 PM');
    });
});

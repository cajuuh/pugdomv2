import type { Translator } from './i18n/translate';

// Dates show as a date and time instead of "3h" when that's switched on in Settings.
// Module state, set by the settings, like the external browser in links.ts.
let absoluteDates = false;
export const setAbsoluteDates = (value: boolean) => {
    absoluteDates = value;
};

const RELATIVE_DAYS = 7;

// "12 nov" (with the year when it isn't this year); with the time, "12 nov, 14:05"
export const absoluteDate = (created: Date, now: Date, locale: string, withTime: boolean) => {
    const date = created.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        ...(created.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
    return withTime ? `${date}, ${created.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : date;
};

// A post's time: "agora", "4min", "3h", "2d", then the date after a week; or always the date and time
export const postTime = (dateString: string, { t, locale }: Translator, now = new Date()) => {
    const created = new Date(dateString);
    if (absoluteDates) return absoluteDate(created, now, locale, true);
    const minutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (minutes < 1) return t('common.now');
    if (minutes < 60) return t('common.minutesShort', { count: minutes });
    if (minutes < 24 * 60) return t('common.hoursShort', { count: Math.floor(minutes / 60) });
    const days = Math.floor(minutes / (24 * 60));
    return days < RELATIVE_DAYS ? t('common.daysShort', { count: days }) : absoluteDate(created, now, locale, false);
};

export const isAbsoluteDates = () => absoluteDates;

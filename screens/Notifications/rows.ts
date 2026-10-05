import { NotificationGroup } from '../../services/mastodon/types';
import { defaultTranslator, Translator } from '../../services/i18n/translate';

// One entry in the list: a section label, or a notification row inside that section's inset group
export type ListItem =
    | { kind: 'section'; key: string; label: string }
    | { kind: 'row'; key: string; group: NotificationGroup; first: boolean; last: boolean };

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Splits rows (newest first) into "Today" and "Earlier" sections
export const buildListItems = (groups: NotificationGroup[], now = new Date(), { t }: Translator = defaultTranslator()): ListItem[] => {
    const today = groups.filter(g => isSameDay(new Date(g.created_at), now));
    const earlier = groups.filter(g => !isSameDay(new Date(g.created_at), now));

    return [
        { id: 'today', label: t('notifications.today'), items: today },
        { id: 'earlier', label: t('notifications.earlier'), items: earlier },
    ].flatMap(({ id, label, items }): ListItem[] =>
        items.length === 0
            ? []
            : [
                { kind: 'section', key: `section-${id}`, label },
                ...items.map((group, index): ListItem => ({
                    kind: 'row',
                    key: group.key,
                    group,
                    first: index === 0,
                    last: index === items.length - 1,
                })),
            ]
    );
};

// "now", "4m", "3h", then the weekday for the past week, then the date
export const notificationTime = (createdAt: string, now = new Date(), { t, locale }: Translator = defaultTranslator()) => {
    const created = new Date(createdAt);
    const minutes = Math.floor((now.getTime() - created.getTime()) / 60000);

    if (minutes < 1) return t('common.now');
    if (minutes < 60) return t('common.minutesShort', { count: minutes });
    if (minutes < 24 * 60) return t('common.hoursShort', { count: Math.floor(minutes / 60) });

    if (minutes < 7 * 24 * 60) {
        return created.toLocaleDateString(locale, {
            weekday: 'short',
        });
    }

    return created.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
    });
};

export { plainText } from '../../services/htmlText';

// "Ana", "Ana and Joon", "Ana, Joon and 4 others": who a row is from, given the names it can show and how many there are
export const actorsText = (names: string[], count: number, { t, tn }: Translator = defaultTranslator()) => {
    const shown = names.slice(0, count > 2 ? 2 : count);
    const others = count - shown.length;
    if (others > 0) return t('common.listAnd', { list: shown.join(', '), last: tn('common.others', others) });
    return shown.length === 2 ? t('common.listAnd', { list: shown[0], last: shown[1] }) : shown[0] ?? '';
};

// Replies start with the handles they're addressed to; drop them unless that's all the post says
export const withoutLeadingMentions = (text: string) => text.replace(/^(?:@[\w.-]+(?:@[\w.-]+)?\s+)+/, '') || text;

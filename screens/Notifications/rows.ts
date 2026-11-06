import { NotificationGroup } from '../../services/mastodon/types';
import { defaultTranslator, Translator } from '../../services/i18n/translate';
import { isNewerId } from '../../services/mastodon/notifications';

// One entry in the list: a section label, or a notification row inside that section's inset group
export type ListItem =
    | { kind: 'section'; key: string; label: string }
    | { kind: 'row'; key: string; group: NotificationGroup; first: boolean; last: boolean; unread: boolean };

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Splits rows (newest first) into "New", "Today" and "Earlier" sections. New: newer than `readPoint`, where
// you'd read up to (null: nothing read yet); while it's still loading (undefined) there's no "New"
export const buildListItems = (groups: NotificationGroup[], now = new Date(), { t }: Translator = defaultTranslator(), readPoint?: string | null): ListItem[] => {
    const isNew = (g: NotificationGroup) => readPoint !== undefined && (readPoint === null || isNewerId(g.newestId, readPoint));
    const unread = groups.filter(isNew);
    const read = groups.filter(g => !isNew(g));
    const today = read.filter(g => isSameDay(new Date(g.created_at), now));
    const earlier = read.filter(g => !isSameDay(new Date(g.created_at), now));

    return [
        { id: 'new', label: t('notifications.new'), items: unread },
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
                    unread: id === 'new',
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

// Replies start with the handles they're addressed to. Yours goes, since the row is already for you; the
// others stay, to show who else it's for. All of it stays if that's all the post says.
export const withoutOwnMention = (text: string, username?: string) => {
    const leading = text.match(/^(?:@[\w.-]+(?:@[\w.-]+)?\s+)+/)?.[0];
    if (!leading || !username) return text;
    const others = leading.trim().split(/\s+/).filter(handle => handle.slice(1).split('@')[0].toLowerCase() !== username.toLowerCase());
    return [...others, text.slice(leading.length)].filter(Boolean).join(' ') || text;
};

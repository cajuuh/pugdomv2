import { NotificationGroup } from '../../services/mastodon/types';

// One entry in the list: a section label, or a notification row inside that section's inset group
export type ListItem =
    | { kind: 'section'; key: string; label: string }
    | { kind: 'row'; key: string; group: NotificationGroup; first: boolean; last: boolean };

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Splits rows (newest first) into "Today" and "Earlier" sections
export const buildListItems = (groups: NotificationGroup[], now = new Date()): ListItem[] => {
    const today = groups.filter(g => isSameDay(new Date(g.created_at), now));
    const earlier = groups.filter(g => !isSameDay(new Date(g.created_at), now));

    return [
        { label: 'Today', items: today },
        { label: 'Earlier', items: earlier },
    ].flatMap(({ label, items }): ListItem[] =>
        items.length === 0
            ? []
            : [
                { kind: 'section', key: `section-${label}`, label },
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
export const notificationTime = (createdAt: string, now = new Date()) => {
    const created = new Date(createdAt);
    const minutes = Math.floor((now.getTime() - created.getTime()) / 60000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;

    if (minutes < 7 * 24 * 60) {
        return created.toLocaleDateString('en-US', {
            weekday: 'short',
        });
    }

    return created.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

// Post HTML as plain text, keeping paragraph and line breaks
export const plainText = (html?: string) =>
    (html ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, entity: string) => ENTITIES[entity])
        .trim();

// "Ana", "Ana and Joon", "Ana, Joon and 4 others": who a row is from, given the names it can show and how many there are
export const actorsText = (names: string[], count: number) => {
    const shown = names.slice(0, count > 2 ? 2 : count);
    const others = count - shown.length;
    if (others > 0) return `${shown.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
    return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown[0] ?? '';
};

// Replies start with the handles they're addressed to; drop them unless that's all the post says
export const withoutLeadingMentions = (text: string) => text.replace(/^(?:@[\w.-]+(?:@[\w.-]+)?\s+)+/, '') || text;

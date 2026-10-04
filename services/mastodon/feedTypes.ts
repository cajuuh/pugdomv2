import type React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Translator } from '../i18n/translate';

export type BuiltinFeedKind = 'home' | 'local' | 'federated' | 'trending';
export type FeedKind = BuiltinFeedKind | 'hashtag' | 'list';

export interface HashtagFeedCriteria {
    tag: string;
    any?: string[];
    all?: string[];
    none?: string[];
}

// A timeline you can pin above Home: the server's built-in ones, trending posts, or hashtag feeds
// (a followed hashtag, or a custom mix of tags). Its id is also its cache key: ['timeline', id].
export interface FeedDescriptor {
    id: string;
    kind: FeedKind;
    title?: string;
    criteria?: HashtagFeedCriteria;
    // For list feeds: the Mastodon list it shows (its title is `title`)
    listId?: string;
    // Home always stays pinned
    canUnpin?: boolean;
}

export const DEFAULT_PINNED_FEEDS: FeedDescriptor[] = [
    { id: 'home', kind: 'home', canUnpin: false },
    { id: 'local', kind: 'local', canUnpin: true },
    { id: 'federated', kind: 'federated', canUnpin: true },
];

export const TRENDING_FEED: FeedDescriptor = {
    id: 'trending',
    kind: 'trending',
    canUnpin: true,
};

export const createHashtagFeed = (tag: string): FeedDescriptor => {
    const clean = tag.replace(/^#/, '').toLowerCase();
    return {
        id: `tag:${clean}`,
        kind: 'hashtag',
        title: `#${clean}`,
        criteria: { tag: clean },
        canUnpin: true,
    };
};

// One of your Mastodon lists as a feed
export const createListFeed = (list: { id: string; title: string }): FeedDescriptor => ({
    id: `list:${list.id}`,
    kind: 'list',
    title: list.title,
    listId: list.id,
    canUnpin: true,
});

export const createCustomHashtagFeed = (
    title: string,
    tag: string,
    anyTags: string[] = [],
    allTags: string[] = [],
    noneTags: string[] = []
): FeedDescriptor => {
    const cleanPrimary = tag.replace(/^#/, '').trim().toLowerCase();
    const cleanAny = anyTags.map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
    const cleanAll = allTags.map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
    const cleanNone = noneTags.map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
    const uniqueId = `custom_tag:${cleanPrimary || 'multi'}_${Date.now()}`;

    return {
        id: uniqueId,
        kind: 'hashtag',
        title: title.trim() || `#${cleanPrimary}`,
        criteria: {
            tag: cleanPrimary,
            any: cleanAny.length > 0 ? cleanAny : undefined,
            all: cleanAll.length > 0 ? cleanAll : undefined,
            none: cleanNone.length > 0 ? cleanNone : undefined,
        },
        canUnpin: true,
    };
};

// The pill / row label in the user's language
export const feedLabel = (feed: FeedDescriptor, { t }: Pick<Translator, 't'>) => {
    switch (feed.kind) {
        case 'home':
            return t('timeline.home');
        case 'local':
            return t('timeline.local');
        case 'federated':
            return t('timeline.federated');
        case 'trending':
            return t('timeline.trending');
        default:
            return feed.title || (feed.criteria?.tag ? `#${feed.criteria.tag}` : feed.id);
    }
};

export const feedIcon = (kind: FeedKind): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (kind) {
        case 'home':
            return 'home-outline';
        case 'local':
            return 'people-outline';
        case 'federated':
            return 'globe-outline';
        case 'trending':
            return 'flame-outline';
        case 'list':
            return 'list-outline';
        default:
            return 'pricetag-outline';
    }
};

// "#cats + #pets, without #dogs": what a hashtag feed shows, for its row
export const describeCriteria = (criteria?: HashtagFeedCriteria) => {
    if (!criteria) return '';
    const tags = [criteria.tag, ...(criteria.any ?? []), ...(criteria.all ?? [])].filter(Boolean).map(tag => `#${tag}`);
    const without = (criteria.none ?? []).map(tag => `#${tag}`);
    return without.length ? `${tags.join(' + ')} − ${without.join(' ')}` : tags.join(' + ');
};

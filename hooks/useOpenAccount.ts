import { useCallback } from 'react';
import { openLink } from '../components/TootCard/htmlContent';
import { fediverseLinkKind, resolveAccount, resolveStatus } from '../services/mastodon/search';
import { Account, Mention } from '../services/mastodon/types';
import { useNavigator } from '../services/navigationContext';

// A mention link only has the profile URL; the post's mentions say which account it is
export const mentionFor = (mentions: Mention[] | undefined, href: string) =>
    mentions?.find(mention => mention.url === href || mention.url === href.replace(/\/$/, ''));

// Opens profiles and hashtags inside pugdom: from an account we have, a mention link, or a hashtag
export const useOpenAccount = () => {
    const { push } = useNavigator();

    const openAccount = useCallback(
        (account: Account) => push({ name: 'account', accountId: account.id, account }),
        [push]
    );

    // Known mention → its account; otherwise ask our server to look the URL up; failing that, the website
    const openMention = useCallback(
        async (href: string, mentions?: Mention[]) => {
            const mention = mentionFor(mentions, href);
            if (mention) {
                push({ name: 'account', accountId: mention.id });
                return;
            }
            try {
                const account = await resolveAccount(href);
                if (account) {
                    push({ name: 'account', accountId: account.id, account });
                    return;
                }
            } catch {
                // fall through to the website
            }
            openLink(href);
        },
        [push]
    );

    // A hashtag link's tag; the screen shows the server's spelling once loaded
    const openHashtag = useCallback((tag: string) => push({ name: 'hashtag', tag }), [push]);

    // Links to posts or profiles (from any server) open in pugdom when our server can fetch them;
    // everything else, or anything it can't find, opens in the browser
    const openLinkInApp = useCallback(
        async (href: string) => {
            const kind = fediverseLinkKind(href);
            try {
                if (kind === 'post') {
                    const status = await resolveStatus(href);
                    if (status) {
                        push({ name: 'thread', statusId: status.id });
                        return;
                    }
                } else if (kind === 'profile') {
                    const account = await resolveAccount(href);
                    if (account) {
                        push({ name: 'account', accountId: account.id, account });
                        return;
                    }
                }
            } catch {
                // fall through to the browser
            }
            openLink(href);
        },
        [push]
    );

    return { openAccount, openMention, openHashtag, openLinkInApp };
};

import { useCallback } from 'react';
import { openLink } from '../components/TootCard/htmlContent';
import { resolveAccount } from '../services/mastodon/search';
import { Account, Mention } from '../services/mastodon/types';
import { useNavigator } from '../services/navigationContext';

// A mention link only has the profile URL; the post's mentions say which account it is
export const mentionFor = (mentions: Mention[] | undefined, href: string) =>
    mentions?.find(mention => mention.url === href || mention.url === href.replace(/\/$/, ''));

// Opens profiles inside pugdom: from an account we have, or from a mention link
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

    return { openAccount, openMention };
};

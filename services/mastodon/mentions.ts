import { Account, Status } from './types';

// Text to start a reply with: the author, then everyone they mentioned, without the current user.
// Uses `acct` (user@domain for remote accounts) so remote users are actually notified.
export const replyMentionsText = (status: Status, currentUser: Account | null) => {
    const accounts = [status.account, ...(status.mentions ?? [])];
    const seen = new Set<string>(currentUser ? [currentUser.id] : []);
    const accts: string[] = [];
    for (const account of accounts) {
        if (!seen.has(account.id)) {
            seen.add(account.id);
            accts.push(account.acct);
        }
    }
    return accts.map(acct => `@${acct} `).join('');
};

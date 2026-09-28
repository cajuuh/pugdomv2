import { countableText, statusLength } from '../services/mastodon/statusLength';
import { replyMentionsText } from '../services/mastodon/mentions';
import { fetchInstanceConfiguration, DEFAULT_INSTANCE_CONFIGURATION } from '../services/mastodon/instance';
import apiClient from '../services/api/client';
import { getCredentials } from '../services/storage';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({ getCredentials: jest.fn() }));

describe('statusLength', () => {
    it('counts plain text by character', () => {
        expect(statusLength('Hello world')).toBe(11);
    });

    it('counts every http(s) URL as 23 characters', () => {
        const url = 'https://example.social/some/really/long/path/that/goes/on?and=on&for=ever';
        expect(statusLength(`see ${url}`)).toBe(4 + 23);
        expect(statusLength('http://a.b')).toBe(23);
    });

    it('keeps trailing punctuation outside the URL', () => {
        expect(countableText('read https://example.social/post.')).toBe(`read ${'x'.repeat(23)}.`);
    });

    it('does not shorten bare domains', () => {
        expect(statusLength('example.social')).toBe(14);
    });

    it('counts only the username of remote mentions', () => {
        expect(statusLength('@alice@very-long-instance-name.example hi')).toBe('@alice hi'.length);
        expect(statusLength('@bob hi')).toBe(7);
    });

    it('does not treat e-mail addresses as mentions', () => {
        expect(countableText('mail me at me@example.com')).toBe('mail me at me@example.com');
    });

    it('includes the content warning', () => {
        expect(statusLength('body', 'CW text')).toBe(4 + 7);
    });

    it('counts an emoji with a skin tone as one character', () => {
        expect(statusLength('👍🏽')).toBe(1);
    });
});

describe('replyMentionsText', () => {
    const account = (id: string, acct: string): Account => ({ id, acct, username: acct.split('@')[0], display_name: acct, avatar: '', emojis: [] });
    const me = account('1', 'me');
    const bob = account('2', 'bob@other.social');
    const carol = account('3', 'carol');

    const status = (author: Account, mentioned: Account[]) => ({
        account: author,
        mentions: mentioned.map(a => ({ id: a.id, acct: a.acct, username: a.username, url: '' })),
    }) as unknown as Status;

    it('mentions the author by full acct so remote users are notified', () => {
        expect(replyMentionsText(status(bob, []), me)).toBe('@bob@other.social ');
    });

    it('also mentions everyone the author mentioned, except me, without duplicates', () => {
        expect(replyMentionsText(status(bob, [me, carol, bob]), me)).toBe('@bob@other.social @carol ');
    });

    it('does not mention myself when replying to my own post', () => {
        expect(replyMentionsText(status(me, [carol]), me)).toBe('@carol ');
    });
});

describe('fetchInstanceConfiguration', () => {
    const mockedGet = apiClient.get as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (getCredentials as jest.Mock).mockResolvedValue({ accessToken: 't', instanceUrl: 'https://one.social' });
    });

    it('reads the limits from the v2 instance endpoint', async () => {
        mockedGet.mockResolvedValue({
            data: { configuration: { statuses: { max_characters: 5000 }, polls: { max_options: 8, max_characters_per_option: 100 } } },
        });

        await expect(fetchInstanceConfiguration()).resolves.toEqual({
            maxCharacters: 5000,
            maxPollOptions: 8,
            maxCharactersPerPollOption: 100,
        });
        expect(mockedGet).toHaveBeenCalledWith('https://one.social/api/v2/instance');
    });

    it("falls back to Mastodon's defaults for missing fields", async () => {
        mockedGet.mockResolvedValue({ data: {} });
        await expect(fetchInstanceConfiguration()).resolves.toEqual(DEFAULT_INSTANCE_CONFIGURATION);
    });
});

import { publicClient } from '../services/api/client';
import { registerOnServer, ServerError } from '../services/mastodon/apps';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: {},
    publicClient: { get: jest.fn(), post: jest.fn() },
}));

const mockedPost = publicClient.post as jest.Mock;
const mockedGet = publicClient.get as jest.Mock;
const app = { client_id: 'id', client_secret: 'secret' };
const httpError = (status?: number) => Object.assign(new Error('Request failed'), { isAxiosError: true, response: status ? { status } : undefined });
const hostMeta = (server: string) =>
    `<?xml version="1.0"?><XRD><Link rel="lrdd" template="${server}/.well-known/webfinger?resource={uri}"/></XRD>`;

const reason = (promise: Promise<unknown>) =>
    promise.then(
        () => null,
        (error: unknown) => (error instanceof ServerError ? `${error.reason} ${error.server}` : error)
    );

beforeEach(() => jest.clearAllMocks());

describe('registerOnServer', () => {
    it('registers on a Mastodon server straight away', async () => {
        mockedPost.mockResolvedValue({ data: app });

        await expect(registerOnServer('https://mastodon.social', 'pugdom://redirect')).resolves.toEqual({ instanceUrl: 'https://mastodon.social', app });
        expect(mockedGet).not.toHaveBeenCalled();
    });

    it('follows host-meta when the handle domain runs Mastodon elsewhere', async () => {
        mockedPost.mockImplementation(async (url: string) => {
            if (url.startsWith('https://social.vivaldi.net/')) return { data: app };
            throw httpError(404);
        });
        mockedGet.mockResolvedValue({ data: hostMeta('https://social.vivaldi.net') });

        await expect(registerOnServer('https://vivaldi.net', 'pugdom://redirect')).resolves.toEqual({ instanceUrl: 'https://social.vivaldi.net', app });
        expect(mockedGet).toHaveBeenCalledWith('https://vivaldi.net/.well-known/host-meta', { responseType: 'text' });
    });

    it("says it's not a Mastodon server when nothing there answers like one", async () => {
        mockedPost.mockRejectedValue(httpError(404));
        mockedGet.mockRejectedValue(httpError(404));
        expect(await reason(registerOnServer('https://example.com', 'pugdom://redirect'))).toBe('notMastodon example.com');

        // A 200 web page instead of an app
        mockedPost.mockResolvedValue({ data: '<html></html>' });
        expect(await reason(registerOnServer('https://example.com', 'pugdom://redirect'))).toBe('notMastodon example.com');
    });

    it("says it can't reach the server when there's no answer at all", async () => {
        mockedPost.mockRejectedValue(httpError());

        expect(await reason(registerOnServer('https://mastodon.socail', 'pugdom://redirect'))).toBe('unreachable mastodon.socail');
    });

    it('passes other server errors on unchanged', async () => {
        const error = httpError(422);
        mockedPost.mockRejectedValue(error);

        expect(await reason(registerOnServer('https://mastodon.social', 'pugdom://redirect'))).toBe(error);
    });
});

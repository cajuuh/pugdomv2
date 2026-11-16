import { FeedDescriptor } from './feedTypes';

// What to subscribe to (Mastodon's streaming API): `user` is Home and notifications
export interface StreamParams {
    stream: string;
    list?: string;
    tag?: string;
}

// `payload` is a JSON string (a post, a notification), or a bare post id for `delete`
export interface StreamEvent {
    stream?: string[];
    event: string;
    payload?: string;
}

// The stream a feed's new posts come on. None for other servers' timelines (read without an account),
// Trending, or hashtag feeds that mix tags.
export const feedStream = (feed: FeedDescriptor): StreamParams | null => {
    switch (feed.kind) {
        case 'home':
            return { stream: 'user' };
        case 'local':
            return { stream: 'public:local' };
        case 'federated':
            return { stream: 'public' };
        case 'list':
            return feed.listId ? { stream: 'list', list: feed.listId } : null;
        case 'hashtag': {
            const criteria = feed.criteria;
            const mixed = criteria?.any?.length || criteria?.all?.length || criteria?.none?.length;
            return criteria?.tag && !mixed ? { stream: 'hashtag', tag: criteria.tag } : null;
        }
        default:
            return null;
    }
};

// One name per subscription, matching what events carry: ['list', '12'] → 'list:12'
export const streamKey = (params: StreamParams) => [params.stream, params.list ?? params.tag?.toLowerCase()].filter(Boolean).join(':');
export const eventKey = (stream: string[] = []) => stream.map((part, i) => (i ? part.toLowerCase() : part)).join(':');

// https://example.social → wss://example.social
export const socketUrl = (base: string) => `${base.replace(/^http/, 'ws').replace(/\/+$/, '')}/api/v1/streaming`;

type Listener = (event: StreamEvent) => void;

// One WebSocket for every stream on screen. Subscriptions and listeners outlive the socket, so a
// reconnect (or another account) picks them up again.
export class StreamConnection {
    private socket: WebSocket | null = null;
    private target: { url: string; token: string } | null = null;
    private subscriptions = new Map<string, { params: StreamParams; count: number }>();
    private listeners = new Set<Listener>();
    private retries = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;

    start(url: string, token: string) {
        this.stop();
        this.target = { url, token };
        this.connect();
    }

    stop() {
        this.target = null;
        clearTimeout(this.timer);
        const socket = this.socket;
        this.socket = null;
        socket?.close();
    }

    // Until the returned function is called
    subscribe(params: StreamParams) {
        const key = streamKey(params);
        const existing = this.subscriptions.get(key);
        if (existing) existing.count++;
        else {
            this.subscriptions.set(key, { params, count: 1 });
            this.send('subscribe', params);
        }
        return () => {
            const current = this.subscriptions.get(key);
            if (!current || --current.count > 0) return;
            this.subscriptions.delete(key);
            this.send('unsubscribe', params);
        };
    }

    listen(listener: Listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private connect() {
        if (!this.target || this.socket) return;
        // The token goes in Sec-WebSocket-Protocol, which Mastodon accepts, so it never sits in a URL
        const socket = new WebSocket(this.target.url, this.target.token);
        this.socket = socket;
        socket.onopen = () => {
            this.retries = 0;
            this.subscriptions.forEach(({ params }) => this.send('subscribe', params));
        };
        socket.onmessage = ({ data }) => {
            let event: StreamEvent;
            try {
                event = JSON.parse(String(data));
            } catch {
                return;
            }
            this.listeners.forEach(listener => listener(event));
        };
        socket.onclose = () => {
            // Closed by stop(), or replaced
            if (this.socket !== socket) return;
            this.socket = null;
            this.timer = setTimeout(() => this.connect(), Math.min(30_000, 1000 * 2 ** this.retries++));
        };
    }

    private send(type: 'subscribe' | 'unsubscribe', params: StreamParams) {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...params }));
    }
}

export const streaming = new StreamConnection();

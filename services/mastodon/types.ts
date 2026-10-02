export interface CustomEmoji {
    shortcode: string;
    url: string;
    static_url: string;
    visible_in_picker: boolean;
    // Set by the server's admins; many servers sort large emoji sets this way
    category?: string | null;
}

export interface Attachment {
    id: string;
    type: 'image' | 'video' | 'gifv' | 'unknown';
    url: string;
    preview_url: string;
    description?: string;
}

export interface Account {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
    header?: string;
    note?: string;
    followers_count?: number;
    following_count?: number;
    statuses_count?: number;
    url?: string;
    emojis: CustomEmoji[];
    // Only present on the logged-in user's own account (verify_credentials)
    source?: {
        language?: string | null;
        // Default visibility for new posts
        privacy?: Status['visibility'];
    };
}

export interface Mention {
    id: string;
    username: string;
    acct: string;
    url: string;
}

export interface PreviewCard {
    url: string;
    title: string;
    description: string;
    type: 'link' | 'photo' | 'video' | 'rich';
    image?: string | null;
    provider_name?: string;
    provider_url?: string;
}

export interface Status {
    id: string;
    created_at: string;
    in_reply_to_id: string | null;
    in_reply_to_account_id: string | null;
    sensitive: boolean;
    spoiler_text: string;
    visibility: 'public' | 'unlisted' | 'private' | 'direct';
    language: string | null;
    uri: string;
    url: string | null; // null for some remote statuses; `uri` is always set
    replies_count: number;
    reblogs_count: number;
    favourites_count: number;
    content: string; //this is a html string
    reblog: Status | null
    account: Account;
    media_attachments: Attachment[];
    mentions?: Mention[];
    emojis: CustomEmoji[];
    favourited?: boolean;
    reblogged?: boolean;
    bookmarked?: boolean;
    card?: PreviewCard | null;
    poll?: Poll | null;
}

export interface PollOption {
    title: string;
    votes_count: number | null;
}

export interface Poll {
    id: string;
    expires_at: string | null;
    expired: boolean;
    multiple: boolean;
    votes_count: number;
    voters_count: number | null;
    voted: boolean;
    own_votes: number[];
    options: PollOption[];
    emojis: CustomEmoji[];
}

export interface Relationship {
    id: string;
    following: boolean;
    requested: boolean;
    followed_by: boolean;
}

export interface Notification {
    id: string;
    type: 'mention' | 'status' | 'reblog' | 'follow' | 'follow_request' | 'favourite' | 'poll' | 'update' | 'admin.sign_up' | 'admin.report' | 'severed_relationships' | 'moderation_warning';
    created_at: string;
    account: Account;
    status?: Status;
}

// One row on the notifications screen: a single notification, or several favourites / boosts of the same post
export interface NotificationGroup {
    key: string;
    type: Notification['type'];
    // Most recent first; a sample when the group is large
    accounts: Account[];
    // How many notifications the group stands for
    count: number;
    status?: Status;
    created_at: string;
    // Newest notification id in the group, for read markers
    newestId: string;
    // Built on the client from v1 pages, so the same post on a later page adds to it
    partial?: boolean;
}

// GET /api/v2/notifications (Mastodon 4.3+)
export interface NotificationGroupV2 {
    group_key: string;
    notifications_count: number;
    type: Notification['type'];
    most_recent_notification_id: string;
    page_min_id?: string;
    page_max_id?: string;
    latest_page_notification_at?: string;
    sample_account_ids: string[];
    status_id?: string | null;
}

export interface GroupedNotificationsResponse {
    accounts: Account[];
    statuses: Status[];
    notification_groups: NotificationGroupV2[];
}


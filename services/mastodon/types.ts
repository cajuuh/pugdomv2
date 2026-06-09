export interface CustomEmoji {
    shortcode: string;
    url: string;
    static_url: string;
    visible_in_picker: boolean;
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
    url: string;
    replies_count: number;
    reblogs_count: number;
    favourites_count: number;
    content: string; //this is a html string
    reblog: Status | null
    account: Account;
    media_attachments: Attachment[];
    emojis: CustomEmoji[];
    favourited?: boolean;
    reblogged?: boolean;
}
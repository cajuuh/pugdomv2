import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { DEFAULT_MAX_CHARACTERS } from './statusLength';

export interface InstanceConfiguration {
    maxCharacters: number;
    maxPollOptions: number;
    maxCharactersPerPollOption: number;
    maxMediaAttachments: number;
    // Bytes, and width × height in pixels
    imageSizeLimit: number;
    imageMatrixLimit: number;
    videoSizeLimit: number;
    // Longest alt text the server accepts
    descriptionLimit: number;
    // MIME types the server takes; empty when it doesn't say
    supportedMimeTypes: string[];
    // Quote posts, with who-can-quote settings (Mastodon 4.5, API version 7)
    supportsQuotes: boolean;
}

// Mastodon's own defaults, used when the instance doesn't report its limits
export const DEFAULT_INSTANCE_CONFIGURATION: InstanceConfiguration = {
    maxCharacters: DEFAULT_MAX_CHARACTERS,
    maxPollOptions: 4,
    maxCharactersPerPollOption: 50,
    maxMediaAttachments: 4,
    imageSizeLimit: 16 * 1024 * 1024,
    imageMatrixLimit: 33177600,
    videoSizeLimit: 99 * 1024 * 1024,
    descriptionLimit: 1500,
    supportedMimeTypes: [],
    supportsQuotes: false,
};

// Mastodon's API version that added quote posts and their policies
const QUOTES_API_VERSION = 7;

interface InstanceV2 {
    api_versions?: { mastodon?: number };
    configuration?: {
        statuses?: { max_characters?: number; max_media_attachments?: number };
        polls?: { max_options?: number; max_characters_per_option?: number };
        media_attachments?: {
            supported_mime_types?: string[];
            image_size_limit?: number;
            image_matrix_limit?: number;
            video_size_limit?: number;
            description_limit?: number;
        };
    };
}

// Akkoma and Pleroma name their limits differently, in v1 only
interface InstanceV1 extends Pick<InstanceV2, 'configuration'> {
    max_toot_chars?: number;
    poll_limits?: { max_options?: number; max_option_chars?: number };
    description_limit?: number;
}

export async function fetchInstanceConfiguration(): Promise<InstanceConfiguration> {
    // apiClient's base URL is /api/v1, so the v2 endpoint needs the full URL
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) {
        throw new Error('No active instance');
    }
    const v2 = await apiClient
        .get<InstanceV2>(`${instanceUrl}/api/v2/instance`)
        .then(response => response.data)
        .catch(() => null);
    // Servers without v2 (Akkoma and Pleroma answer "Not implemented") report their limits in v1
    const v1 = v2?.configuration?.statuses?.max_characters
        ? null
        : (await apiClient.get<InstanceV1>(`${instanceUrl}/api/v1/instance`)).data;
    const { statuses, polls, media_attachments: media } = v2?.configuration ?? v1?.configuration ?? {};
    const defaults = DEFAULT_INSTANCE_CONFIGURATION;
    return {
        maxCharacters: statuses?.max_characters ?? v1?.max_toot_chars ?? defaults.maxCharacters,
        maxPollOptions: polls?.max_options ?? v1?.poll_limits?.max_options ?? defaults.maxPollOptions,
        maxCharactersPerPollOption: polls?.max_characters_per_option ?? v1?.poll_limits?.max_option_chars ?? defaults.maxCharactersPerPollOption,
        maxMediaAttachments: statuses?.max_media_attachments ?? defaults.maxMediaAttachments,
        imageSizeLimit: media?.image_size_limit ?? defaults.imageSizeLimit,
        imageMatrixLimit: media?.image_matrix_limit ?? defaults.imageMatrixLimit,
        videoSizeLimit: media?.video_size_limit ?? defaults.videoSizeLimit,
        descriptionLimit: media?.description_limit ?? v1?.description_limit ?? defaults.descriptionLimit,
        supportedMimeTypes: media?.supported_mime_types ?? defaults.supportedMimeTypes,
        supportsQuotes: (v2?.api_versions?.mastodon ?? 0) >= QUOTES_API_VERSION,
    };
}

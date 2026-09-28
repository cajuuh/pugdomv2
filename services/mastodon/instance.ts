import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { DEFAULT_MAX_CHARACTERS } from './statusLength';

export interface InstanceConfiguration {
    maxCharacters: number;
    maxPollOptions: number;
    maxCharactersPerPollOption: number;
}

// Mastodon's own defaults, used when the instance doesn't report its limits
export const DEFAULT_INSTANCE_CONFIGURATION: InstanceConfiguration = {
    maxCharacters: DEFAULT_MAX_CHARACTERS,
    maxPollOptions: 4,
    maxCharactersPerPollOption: 50,
};

interface InstanceV2 {
    configuration?: {
        statuses?: { max_characters?: number };
        polls?: { max_options?: number; max_characters_per_option?: number };
    };
}

export async function fetchInstanceConfiguration(): Promise<InstanceConfiguration> {
    // apiClient's base URL is /api/v1, so the v2 endpoint needs the full URL
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) {
        throw new Error('No active instance');
    }
    const response = await apiClient.get<InstanceV2>(`${instanceUrl}/api/v2/instance`);
    const { statuses, polls } = response.data.configuration ?? {};
    return {
        maxCharacters: statuses?.max_characters ?? DEFAULT_INSTANCE_CONFIGURATION.maxCharacters,
        maxPollOptions: polls?.max_options ?? DEFAULT_INSTANCE_CONFIGURATION.maxPollOptions,
        maxCharactersPerPollOption: polls?.max_characters_per_option ?? DEFAULT_INSTANCE_CONFIGURATION.maxCharactersPerPollOption,
    };
}

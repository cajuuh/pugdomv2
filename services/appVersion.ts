import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// "1.0.0", or "1.0.0 · update 1a2b3c4d (preview)" when running an OTA update, so testers can tell builds apart
export const appVersionLabel = () => {
    const version = Constants.expoConfig?.version ?? 'unknown';
    if (Updates.isEmbeddedLaunch || !Updates.updateId) {
        return version;
    }
    const channel = Updates.channel ? ` (${Updates.channel})` : '';
    return `${version} · update ${Updates.updateId.slice(0, 8)}${channel}`;
};

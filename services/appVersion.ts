import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { defaultTranslator, Translator } from './i18n/translate';

// The installed build's version, "1.3.0"
export const appVersionLabel = () => Constants.expoConfig?.version ?? 'unknown';

const pad = (value: number) => String(value).padStart(2, '0');

// Which code is running, so testers can tell: "Built-in" for the code the build came with; for an over-the-air
// update, when it was published and the commit it came from (CI sets EXPO_PUBLIC_GIT_COMMIT), or its id
export const codeVersionLabel = ({ t }: Translator = defaultTranslator()) => {
    if (Updates.isEmbeddedLaunch || !Updates.updateId) {
        return t('settings.codeBuiltIn');
    }
    const at = Updates.createdAt;
    const date = at && `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
    const commit = process.env.EXPO_PUBLIC_GIT_COMMIT?.slice(0, 7) || Updates.updateId.slice(0, 8);
    const channel = Updates.channel ? ` (${Updates.channel})` : '';
    return `${[date, commit].filter(Boolean).join(' · ')}${channel}`;
};

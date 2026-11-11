import { Platform, Settings } from 'react-native';

// The languages pugdon speaks, in the order Settings lists them; pt-BR is the default
export type Language = 'pt-BR' | 'en' | 'es-419' | 'de' | 'fr' | 'eo' | 'la' | 'ja' | 'zh-CN';

export const LANGUAGES: Language[] = ['pt-BR', 'en', 'es-419', 'de', 'fr', 'eo', 'la', 'ja', 'zh-CN'];

export const DEFAULT_LANGUAGE: Language = 'pt-BR';

// The phone's languages, most preferred first. iOS lists them all (a language picked for pugdon in iOS Settings
// comes first); on Android, Intl reports the phone's language.
export const phoneLocales = (): string[] => {
    try {
        const apple = Platform.OS === 'ios' ? Settings.get('AppleLanguages') : undefined;
        return Array.isArray(apple) ? apple : [Intl.DateTimeFormat().resolvedOptions().locale];
    } catch {
        return [];
    }
};

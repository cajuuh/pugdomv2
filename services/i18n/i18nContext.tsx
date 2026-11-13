import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCredentials, getStringSetting, saveStringSetting } from '../storage';
import { DEFAULT_LANGUAGE, Language, LANGUAGES, phoneLocales } from './defaults';
import { createTranslator, Translator } from './translate';

export const LANGUAGE_KEY = 'pugdom_settings_language';

interface I18nContextType extends Translator {
    setLanguage: (language: Language) => Promise<void>;
    // The saved language has been read (the splash stays up until then, so there's no flash of the default)
    languageReady: boolean;
}

// The first of the phone's languages pugdon speaks (es-AR gives Spanish, en-GB English); the default when none
export const phoneLanguage = (locales: string[]): Language => {
    for (const locale of locales) {
        const base = locale.split(/[-_]/)[0].toLowerCase();
        const match = LANGUAGES.find(language => language.split('-')[0] === base);
        if (match) return match;
    }
    return DEFAULT_LANGUAGE;
};

// No saved language yet: a new install follows the phone. Someone already signed in has used pugdon in the default
// language all along (it didn't follow the phone before), so they keep it. Saved either way, so it stays put.
const firstLanguage = async (): Promise<Language> => {
    const { accessToken } = await getCredentials().catch(() => ({ accessToken: null }));
    const language = accessToken ? DEFAULT_LANGUAGE : phoneLanguage(phoneLocales());
    await saveStringSetting(LANGUAGE_KEY, language);
    return language;
};

const fallback: I18nContextType = {
    ...createTranslator(DEFAULT_LANGUAGE),
    setLanguage: async () => {},
    languageReady: true,
};

const I18nContext = createContext<I18nContextType>(fallback);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
    const [languageReady, setLanguageReady] = useState(false);

    useEffect(() => {
        getStringSetting(LANGUAGE_KEY, '')
            .then(async saved => {
                if ((LANGUAGES as string[]).includes(saved)) setLanguageState(saved as Language);
                else if (!saved) setLanguageState(await firstLanguage());
            })
            .catch(() => {})
            .finally(() => setLanguageReady(true));
    }, []);

    const value = useMemo<I18nContextType>(
        () => ({
            ...createTranslator(language),
            languageReady,
            setLanguage: async (next: Language) => {
                setLanguageState(next);
                await saveStringSetting(LANGUAGE_KEY, next);
            },
        }),
        [language, languageReady]
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// Works without a provider too (component tests): then it's the default language
export const useI18n = () => useContext(I18nContext);

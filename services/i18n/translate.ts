import { DEFAULT_LANGUAGE, Language } from './defaults';
import { Dictionary, en } from './en';
import { ptBR } from './pt-BR';
import { es419 } from './es-419';
import { de } from './de';
import { fr } from './fr';
import { eo } from './eo';
import { la } from './la';
import { ja } from './ja';
import { zhCN } from './zh-CN';

export const DICTIONARIES: Record<Language, Dictionary> = { en, 'pt-BR': ptBR, 'es-419': es419, de, fr, eo, la, ja, 'zh-CN': zhCN };

// Locale for dates and numbers
export const LOCALES: Record<Language, string> = {
    en: 'en-US', 'pt-BR': 'pt-BR', 'es-419': 'es-419', de: 'de-DE', fr: 'fr-FR', eo: 'eo', la: 'la', ja: 'ja-JP', 'zh-CN': 'zh-CN',
};

// The language posts are translated into, among Mastodon's own locales (it has es, es-AR and es-MX, no es-419).
// Translation services don't do Latin, so Latin readers get English.
export const MASTODON_LOCALES: Record<Language, string> = {
    en: 'en', 'pt-BR': 'pt-BR', 'es-419': 'es', de: 'de', fr: 'fr', eo: 'eo', la: 'en', ja: 'ja', 'zh-CN': 'zh-CN',
};

// Every dotted path to a string in the dictionary, e.g. 'settings.title'
type Leaves<T, P extends string = ''> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly string[] ? never : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
// Keys with `_one` / `_other` forms, used with tn()
export type PluralKey = TKey extends infer K ? (K extends `${infer Base}_one` ? Base : never) : never;

export type Params = Record<string, string | number>;

export interface Translator {
    language: Language;
    locale: string;
    dict: Dictionary;
    t: (key: TKey, params?: Params) => string;
    // Picks key_one or key_other for the count, which is also available as {{count}}
    tn: (key: PluralKey, count: number, params?: Params) => string;
}

const lookup = (dict: Dictionary, key: string): string | undefined => {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
    return typeof value === 'string' ? value : undefined;
};

const interpolate = (text: string, params?: Params) =>
    params ? text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;

// Portuguese and French use the singular for 0 and 1 ("0 voto", "1 voto"); the others only for 1
// (Japanese and Chinese have one form, so their _one and _other say the same)
export const pluralForm = (language: Language, count: number): 'one' | 'other' =>
    language === 'pt-BR' || language === 'fr' ? (Math.abs(count) < 2 ? 'one' : 'other') : count === 1 ? 'one' : 'other';

const translators = new Map<Language, Translator>();

export const createTranslator = (language: Language): Translator => {
    const cached = translators.get(language);
    if (cached) return cached;
    const dict = DICTIONARIES[language];
    // A key missing from a dictionary (can't happen while the types hold) falls back to English, then the key
    const t = (key: TKey, params?: Params) => interpolate(lookup(dict, key) ?? lookup(en, key) ?? key, params);
    const tn = (key: PluralKey, count: number, params?: Params) =>
        t(`${key}_${pluralForm(language, count)}` as TKey, { count, ...params });
    const translator = { language, locale: LOCALES[language], dict, t, tn };
    translators.set(language, translator);
    return translator;
};

// For helpers outside React that aren't handed a translator (tests run in English, see jest.setup.js)
export const defaultTranslator = () => createTranslator(DEFAULT_LANGUAGE);

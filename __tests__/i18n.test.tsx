import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { en } from '../services/i18n/en';
import { ptBR } from '../services/i18n/pt-BR';
import { createTranslator, pluralForm } from '../services/i18n/translate';
import { I18nProvider, LANGUAGE_KEY, useI18n } from '../services/i18n/i18nContext';
import { DEFAULT_LANGUAGE } from '../services/i18n/defaults';
import { describeHidden, countMedia } from '../components/TootCard/tootCard';
import { actorsText, notificationTime } from '../screens/Notifications/rows';
import { pollTimeLeft } from '../components/Poll/poll';
import { Attachment, Status } from '../services/mastodon/types';
import { TabBar } from '../components/TabBar/tabBar';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

// Every key path in a dictionary, with arrays as one entry
const keysOf = (node: unknown, prefix = ''): string[] =>
    typeof node === 'object' && node !== null && !Array.isArray(node)
        ? Object.entries(node).flatMap(([key, value]) => keysOf(value, `${prefix}${key}.`))
        : [prefix.slice(0, -1)];

describe('dictionaries', () => {
    it('have exactly the same keys', () => {
        expect(keysOf(ptBR).sort()).toEqual(keysOf(en).sort());
    });

    it('fill in every placeholder the English text uses', () => {
        const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
        const pairs = keysOf(en).map(key => [key, key.split('.').reduce<any>((n, p) => n[p], en), key.split('.').reduce<any>((n, p) => n[p], ptBR)]);
        for (const [key, english, portuguese] of pairs) {
            if (typeof english !== 'string') continue;
            expect([key, placeholders(portuguese)]).toEqual([key, placeholders(english)]);
        }
    });

    it('give the pug as many messages in Portuguese as in English', () => {
        expect(ptBR.setup.messages).toHaveLength(en.setup.messages.length);
    });
});

describe('translator', () => {
    const pt = createTranslator('pt-BR');
    const english = createTranslator('en');

    it('fills in parameters', () => {
        expect(pt.t('settings.switchTo', { name: 'Ana' })).toBe('Trocar para Ana');
        expect(english.t('settings.switchTo', { name: 'Ana' })).toBe('Switch to Ana');
    });

    it('uses the singular for 0 and 1 in Portuguese, only 1 in English', () => {
        expect(pluralForm('pt-BR', 0)).toBe('one');
        expect(pluralForm('pt-BR', 1)).toBe('one');
        expect(pluralForm('pt-BR', 2)).toBe('other');
        expect(pluralForm('en', 0)).toBe('other');
        expect(pt.tn('poll.votes', 0)).toBe('0 voto');
        expect(pt.tn('poll.votes', 5)).toBe('5 votos');
        expect(english.tn('poll.votes', 1)).toBe('1 vote');
    });

    it('formats the sentence helpers in Portuguese', () => {
        const media = (type: Attachment['type'], id: string): Attachment => ({ id, type, url: '', preview_url: '' });
        const status = { content: '<p>oi</p>', media_attachments: [media('image', '1'), media('image', '2')] } as Status;

        expect(countMedia([media('video', '1')], pt)).toBe('1 vídeo');
        expect(describeHidden(status, pt)).toBe('Oculto: texto e 2 fotos');
        expect(actorsText(['Ana', 'Joon', 'Bia'], 6, pt)).toBe('Ana, Joon e mais 4 pessoas');
        expect(actorsText(['Ana', 'Joon'], 2, pt)).toBe('Ana e Joon');

        const now = new Date('2026-10-02T12:00:00Z');
        expect(notificationTime('2026-10-02T11:56:00Z', now, pt)).toBe('4min');
        expect(pollTimeLeft({ expired: false, expires_at: '2026-10-02T15:00:30Z' }, now.getTime(), pt)).toBe('faltam 3h');
    });
});

describe('I18nProvider', () => {
    const Probe = () => {
        const { t, language, setLanguage } = useI18n();
        return (
            <>
                <Text testID="language">{language}</Text>
                <Text>{t('tabs.home')}</Text>
                <Text onPress={() => setLanguage('en')}>switch</Text>
            </>
        );
    };

    beforeEach(() => AsyncStorage.clear());

    it('starts in Portuguese (Brazil) by default', async () => {
        jest.isolateModules(() => {
            expect(jest.requireActual('../services/i18n/defaults').DEFAULT_LANGUAGE).toBe('pt-BR');
        });
        // Tests themselves run in English (jest.setup.js)
        expect(DEFAULT_LANGUAGE).toBe('en');
    });

    it('restores the saved language and remembers a new choice', async () => {
        await AsyncStorage.setItem(LANGUAGE_KEY, 'pt-BR');
        await render(
            <I18nProvider>
                <Probe />
            </I18nProvider>
        );
        await waitFor(() => expect(screen.getByTestId('language').props.children).toBe('pt-BR'));
        expect(screen.getByText('Início')).toBeTruthy();

        await act(async () => {
            screen.getByText('switch').props.onPress();
        });

        expect(screen.getByText('Home')).toBeTruthy();
        expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('en');
    });

    it('ignores a saved value it does not know', async () => {
        await AsyncStorage.setItem(LANGUAGE_KEY, 'klingon');
        await render(
            <I18nProvider>
                <Probe />
            </I18nProvider>
        );
        await waitFor(() => expect(screen.getByTestId('language').props.children).toBe(DEFAULT_LANGUAGE));
    });
});

describe('screens in Portuguese', () => {
    beforeEach(() => AsyncStorage.clear());

    it('labels the tray in the saved language', async () => {
        await AsyncStorage.setItem(LANGUAGE_KEY, 'pt-BR');
        await render(
            <I18nProvider>
                <TabBar activeTab="home" onTabPress={jest.fn()} onComposePress={jest.fn()} />
            </I18nProvider>
        );

        expect(await screen.findByRole('tab', { name: 'Início' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Notificações' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Nova publicação' })).toBeTruthy();
    });
});

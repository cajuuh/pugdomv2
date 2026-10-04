import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import Search from '../screens/Search/search';
import LinkTimeline from '../screens/LinkTimeline/linkTimeline';
import { NewsCard } from '../components/NewsCard/newsCard';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Status } from '../services/mastodon/types';
import { TrendLink } from '../services/mastodon/trends';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recentSearchKey } from '../services/recentSearches';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../components/TootCard/tootCard', () => ({
    TootCard: ({ status, onPress }: { status: Status; onPress?: (id: string) => void }) => {
        const { Pressable, Text: MockText } = jest.requireActual('react-native');
        return (
            <Pressable onPress={() => onPress?.(status.id)}>
                <MockText>{status.content}</MockText>
            </Pressable>
        );
    },
}));

const get = apiClient.get as jest.Mock;
const WebBrowser = jest.requireMock('expo-web-browser');

const trendingStatus = { id: 'trend-1', content: 'trending pug post' };
const trendingTag = { name: 'puglife', url: 'https://pug.social/tags/puglife', history: [{ day: '1', uses: '10', accounts: '5' }] };
const trendingNews: TrendLink = {
    url: 'https://pugnews.com/article/1',
    title: 'Pugs Take Over the World',
    description: 'A delightful event in canine history.',
    type: 'link',
    provider_name: 'Pug News',
    provider_url: 'https://pugnews.com',
    image: 'https://pugnews.com/pug.jpg',
    author_name: 'Reporter Pug',
    author_url: '',
    html: '',
    width: 600,
    height: 400,
    blurhash: null,
    history: [{ day: '1', uses: '8', accounts: '4' }],
};
const suggestedAccount = {
    id: 'sug-1',
    username: 'puggles',
    acct: 'puggles@pug.social',
    display_name: 'Puggles',
    avatar: '',
    emojis: [],
};

const StackProbe = () => {
    const { stack } = useNavigator();
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText testID="stack">{JSON.stringify(stack.map(entry => entry.route))}</MockText>;
};

const renderSearch = (onStatusPress = jest.fn()) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationProvider>
                <Search onStatusPress={onStatusPress} />
                <StackProbe />
            </NavigationProvider>
        </QueryClientProvider>
    );

const renderWithProviders = (ui: React.ReactElement) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationProvider>{ui}</NavigationProvider>
        </QueryClientProvider>
    );

describe('Explore on Search screen', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();

        get.mockImplementation(async (url: string) => {
            if (url.includes('/trends/statuses')) {
                return { data: [trendingStatus] };
            }
            if (url.includes('/trends/tags')) {
                return { data: [trendingTag] };
            }
            if (url.includes('/trends/links')) {
                return { data: [trendingNews] };
            }
            if (url.includes('/suggestions')) {
                return { data: [{ source: 'featured', account: suggestedAccount }] };
            }
            if (url.includes('/accounts/relationships')) {
                return { data: [{ id: 'sug-1', following: false, requested: false, followed_by: false }] };
            }
            return { data: [] };
        });
    });

    it('shows explore tabs when query is empty and defaults to trending posts', async () => {
        await renderSearch();

        expect(screen.getByText('Posts')).toBeTruthy();
        expect(screen.getByText('Hashtags')).toBeTruthy();
        expect(screen.getByText('News')).toBeTruthy();
        expect(screen.getByText('People')).toBeTruthy();

        expect(await screen.findByText('trending pug post')).toBeTruthy();
    });

    it('switches to trending hashtags tab and renders hashtags', async () => {
        await renderSearch();

        const hashtagTab = screen.getByText('Hashtags');
        await fireEvent.press(hashtagTab);

        expect(await screen.findByText('#puglife')).toBeTruthy();
    });

    it('switches to news tab and renders trending news links', async () => {
        await renderSearch();

        const newsTab = screen.getByText('News');
        await fireEvent.press(newsTab);

        expect(await screen.findByText('Pugs Take Over the World')).toBeTruthy();
        expect(screen.getByText('Pug News')).toBeTruthy();
    });

    it('switches to people tab and renders suggested accounts', async () => {
        await renderSearch();

        const peopleTab = screen.getByText('People');
        await fireEvent.press(peopleTab);

        expect(await screen.findByText('Puggles')).toBeTruthy();
    });

    it('displays and interacts with recent searches', async () => {
        await AsyncStorage.setItem(recentSearchKey('me'), JSON.stringify(['cute pugs', 'fediverse']));

        await renderSearch();

        expect(await screen.findByText('Recent')).toBeTruthy();
        expect(screen.getByText('cute pugs')).toBeTruthy();
        expect(screen.getByText('fediverse')).toBeTruthy();

        // Tapping a recent search fills the search field
        await fireEvent.press(screen.getByText('cute pugs'));
        expect(screen.getByDisplayValue('cute pugs')).toBeTruthy();

        // Removing a recent search removes the chip
        const removeButton = screen.getByLabelText('Remove fediverse from recent searches');
        await fireEvent.press(removeButton);

        await waitFor(() => {
            expect(screen.queryByText('fediverse')).toBeNull();
        });
    });

    it('clears all recent searches when Clear is pressed', async () => {
        await AsyncStorage.setItem(recentSearchKey('me'), JSON.stringify(['puppy', 'hound']));

        await renderSearch();

        expect(await screen.findByText('Clear')).toBeTruthy();
        await fireEvent.press(screen.getByText('Clear'));

        await waitFor(() => {
            expect(screen.queryByText('Recent')).toBeNull();
            expect(screen.queryByText('puppy')).toBeNull();
        });
    });
});

describe('NewsCard component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens article URL in browser when Read article is pressed', async () => {
        await renderWithProviders(<NewsCard link={trendingNews} />);

        await fireEvent.press(screen.getByText('Read article'));
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://pugnews.com/article/1');
    });

    it('invokes onPressLinkTimeline when View posts is pressed', async () => {
        const onTimeline = jest.fn();
        await renderWithProviders(<NewsCard link={trendingNews} onPressLinkTimeline={onTimeline} />);

        await fireEvent.press(screen.getByText('View posts'));
        expect(onTimeline).toHaveBeenCalledWith('https://pugnews.com/article/1', 'Pugs Take Over the World');
    });
});

describe('LinkTimeline screen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches and displays posts sharing a link', async () => {
        get.mockResolvedValueOnce({ data: [{ id: 'lp1', content: 'check out this news!' }] });
        const onBack = jest.fn();
        const onStatusPress = jest.fn();

        await renderWithProviders(
            <LinkTimeline
                url="https://pugnews.com/article/1"
                title="Pugs Take Over the World"
                onBack={onBack}
                onStatusPress={onStatusPress}
            />
        );

        expect(screen.getAllByText('Pugs Take Over the World').length).toBeGreaterThan(0);
        expect(await screen.findByText('check out this news!')).toBeTruthy();

        // Tapping status invokes onStatusPress
        await fireEvent.press(screen.getByText('check out this news!'));
        expect(onStatusPress).toHaveBeenCalledWith('lp1');

        // Back button invokes onBack
        await fireEvent.press(screen.getByLabelText('Go back'));
        expect(onBack).toHaveBeenCalled();
    });

    it('renders unsupported message and open button when server errors on link timeline', async () => {
        get.mockRejectedValueOnce({ response: { status: 404 } });

        await renderWithProviders(
            <LinkTimeline
                url="https://pugnews.com/article/1"
                title="Pugs"
                onBack={jest.fn()}
                onStatusPress={jest.fn()}
            />
        );

        expect(await screen.findByText(/Your server doesn't support link timelines/)).toBeTruthy();
        await fireEvent.press(screen.getAllByText('Read article')[0]);
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://pugnews.com/article/1');
    });
});

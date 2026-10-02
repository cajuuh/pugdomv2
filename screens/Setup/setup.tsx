import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PillButton, PugMark } from '../../components/ui';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { getCredentials } from '../../services/storage';
import { loadCachedEmojis, prefetchEmojiImages } from '../../services/emojiCache';
import { CustomEmoji } from '../../services/mastodon/types';
import { fetchInstanceConfiguration } from '../../services/mastodon/instance';
import { CUSTOM_EMOJIS_KEY, EMOJI_STALE_TIME, fetchAndCacheEmojis } from '../../hooks/useCustomEmojis';
import { makeStyles } from './styles';

// Setup never holds the user longer than this
export const SETUP_TIMEOUT_MS = 30_000;

export type SetupStep = 'emojis' | 'images' | 'limits' | 'done';

export interface SetupProgress {
    step: SetupStep;
    imagesDone: number;
    imagesTotal: number;
}

// Downloads what composing needs from a new server: its custom emoji (stored per server), their images,
// and its limits. Skipped when the server's emoji are already stored. Each step's failure is ignored.
export async function runSetup(queryClient: QueryClient, onProgress: (progress: SetupProgress) => void) {
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) return;
    const cached = await loadCachedEmojis(instanceUrl);
    if (cached) {
        queryClient.setQueryData(CUSTOM_EMOJIS_KEY, cached.emojis, { updatedAt: cached.savedAt });
        return;
    }

    onProgress({ step: 'emojis', imagesDone: 0, imagesTotal: 0 });
    let emojis: CustomEmoji[] = [];
    try {
        // Through the query cache, so it shares the request with the launch primer (useEmojiCachePrimer)
        emojis = await queryClient.fetchQuery({ queryKey: CUSTOM_EMOJIS_KEY, queryFn: fetchAndCacheEmojis, staleTime: EMOJI_STALE_TIME });
    } catch {
        // The picker fetches them later
    }

    await prefetchEmojiImages(emojis, (imagesDone, imagesTotal) => onProgress({ step: 'images', imagesDone, imagesTotal }));

    onProgress({ step: 'limits', imagesDone: 0, imagesTotal: 0 });
    await queryClient
        .prefetchQuery({ queryKey: ['instance', 'configuration'], queryFn: fetchInstanceConfiguration, staleTime: 60 * 60 * 1000 })
        .catch(() => {});
}

// What the pug is up to while things load; the details (thousands of emoji on big servers) stay behind the scenes
export const SETUP_MESSAGES = [
    'Barking at a tree',
    "Sniffing out your server's emoji",
    'Chasing our own tail',
    'Fetching the ball… and your emoji',
    'Snorting happily',
    'Burying emoji for later',
    'Looking for a sunny spot',
    'Wiggling a curly tail',
    'Waiting patiently for treats',
    'Just a tiny nap',
];
const MESSAGE_INTERVAL_MS = 2500;

// One bar for the whole setup: the emoji list is quick, the images take most of the time
export const setupFraction = ({ step, imagesDone, imagesTotal }: SetupProgress) => {
    switch (step) {
        case 'emojis':
            return 0.05;
        case 'images':
            return 0.1 + (imagesTotal > 0 ? (0.8 * imagesDone) / imagesTotal : 0);
        case 'limits':
            return 0.95;
        default:
            return 1;
    }
};

interface SetupProps {
    onDone: () => void;
}

// Shown once after logging in to (or adding) an account on a server we haven't set up yet
const Setup: React.FC<SetupProps> = ({ onDone }) => {
    const { type, coat } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    // Nothing shows until we know there's work to do, so cached servers don't flash this screen
    const [progress, setProgress] = useState<SetupProgress | null>(null);
    const [server, setServer] = useState('');
    const [message, setMessage] = useState(0);
    const finished = useRef(false);
    const finish = useRef(() => {
        if (finished.current) return;
        finished.current = true;
        onDone();
    }).current;

    useEffect(() => {
        getCredentials()
            .then(({ instanceUrl }) => setServer(instanceUrl?.replace(/^https?:\/\//i, '') ?? ''))
            .catch(() => {});
        const timeout = setTimeout(finish, SETUP_TIMEOUT_MS);
        runSetup(queryClient, setProgress)
            .catch(() => {})
            .finally(() => {
                clearTimeout(timeout);
                finish();
            });
        const rotate = setInterval(() => setMessage(index => (index + 1) % SETUP_MESSAGES.length), MESSAGE_INTERVAL_MS);
        return () => {
            clearTimeout(timeout);
            clearInterval(rotate);
        };
    }, [queryClient, finish]);

    if (!progress) {
        return <View style={styles.container} />;
    }

    const percent = Math.round(setupFraction(progress) * 100);

    return (
        <View style={styles.container}>
            <PugMark coat={coat} size={88} />
            <Text accessibilityRole="header" style={[type.title, styles.title]}>Setting things up</Text>
            {!!server && <Text style={[type.body, styles.server]}>{server}</Text>}

            {/* The jokes are for sighted users; screen readers get the bar's percentage */}
            <Text style={[type.name, styles.message]} importantForAccessibility="no" accessibilityElementsHidden>
                {SETUP_MESSAGES[message]}…
            </Text>
            <View
                style={styles.track}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Setting things up"
                accessibilityValue={{ min: 0, max: 100, now: percent }}
            >
                <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>

            <PillButton label="Skip" variant="ghost" onPress={finish} style={styles.skip} />
        </View>
    );
};

export default Setup;

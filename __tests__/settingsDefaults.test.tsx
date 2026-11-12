import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';
import { POST_TEXT_SIZE_KEY, SettingsProvider, UNCROPPED_MEDIA_KEY, useSettings } from '../services/settingsContext';
import { postTextMetrics } from '../components/TootCard/styles';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), deleteItemAsync: jest.fn() }));

const Probe = () => <Text>{useSettings().uncroppedMedia ? 'whole' : 'cropped'}</Text>;

beforeEach(() => AsyncStorage.clear());

describe('Uncropped images', () => {
    it('are on by default', async () => {
        await render(<SettingsProvider><Probe /></SettingsProvider>);
        expect(await screen.findByText('whole')).toBeTruthy();
    });

    it('stay off for someone who turned them off', async () => {
        await AsyncStorage.setItem(UNCROPPED_MEDIA_KEY, 'false');
        await render(<SettingsProvider><Probe /></SettingsProvider>);
        expect(await screen.findByText('cropped')).toBeTruthy();
    });
});

describe('Post text size', () => {
    const SizeProbe = () => {
        const { postTextSize, setPostTextSize } = useSettings();
        return <Text onPress={() => setPostTextSize('large')}>{postTextSize}</Text>;
    };

    it('starts at the default and remembers a choice', async () => {
        await render(<SettingsProvider><SizeProbe /></SettingsProvider>);
        await fireEvent.press(await screen.findByText('default'));
        expect(await screen.findByText('large')).toBeTruthy();
        expect(await AsyncStorage.getItem(POST_TEXT_SIZE_KEY)).toBe('large');

        screen.unmount();
        await render(<SettingsProvider><SizeProbe /></SettingsProvider>);
        expect(await screen.findByText('large')).toBeTruthy();
    });

    it("keeps each mode's sizes by default and scales them", () => {
        expect(postTextMetrics(false)).toEqual({ fontSize: 15.5, lineHeight: 22.5 });
        expect(postTextMetrics(true)).toEqual({ fontSize: 13, lineHeight: 18 });
        // Compact Mode's largest step is bigger than the normal default
        expect(postTextMetrics(true, 'larger').fontSize).toBeGreaterThan(postTextMetrics(false).fontSize);
        expect(postTextMetrics(true, 'small').fontSize).toBeLessThan(13);
    });
});

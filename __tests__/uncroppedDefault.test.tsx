import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsProvider, UNCROPPED_MEDIA_KEY, useSettings } from '../services/settingsContext';

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

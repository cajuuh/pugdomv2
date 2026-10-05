import React, { useState } from 'react';
import { DeviceEventEmitter, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { createServerFeed } from '../../services/mastodon/feedTypes';
import { checkServer, normalizeDomain, ServerCheck } from '../../services/mastodon/servers';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Card, IconButton, PillButton, SectionLabel } from '../../components/ui';
import { FEED_CREATED_EVENT, FEED_OPEN_EVENT } from '../FeedEditor/feedEditor';

interface ServerPickerProps {
    onBack: () => void;
}

// Pins another server's local timeline: type its address, check that it shows its timeline to
// visitors, then pin it. Read without an account there.
const ServerPicker = ({ onBack }: ServerPickerProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { pinFeed } = usePinnedFeeds();
    const [address, setAddress] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<ServerCheck | null>(null);
    const [pinning, setPinning] = useState(false);

    const domain = normalizeDomain(address);

    const changeAddress = (text: string) => {
        setAddress(text);
        setResult(null);
    };

    const check = async () => {
        if (!domain || checking) return;
        setChecking(true);
        try {
            setResult(await checkServer(domain));
        } finally {
            setChecking(false);
        }
    };

    const pin = async () => {
        if (!result?.ok) return;
        setPinning(true);
        try {
            const feed = createServerFeed(result.server);
            await pinFeed(feed);
            DeviceEventEmitter.emit(FEED_CREATED_EVENT, feed);
            onBack();
        } finally {
            setPinning(false);
        }
    };

    // Just look, without pinning
    const preview = () => {
        if (!result?.ok) return;
        DeviceEventEmitter.emit(FEED_OPEN_EVENT, createServerFeed(result.server));
        onBack();
    };

    const problem = result && !result.ok ? t(`servers.${result.reason}`, { domain }) : null;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('servers.add')}
                </Text>
                <View style={styles.spacer} />
            </View>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('servers.address')}</SectionLabel>
                    <View style={styles.inputRow}>
                        <TextInput
                            value={address}
                            onChangeText={changeAddress}
                            onSubmitEditing={check}
                            placeholder={t('servers.addressPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            accessibilityLabel={t('servers.address')}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            returnKeyType="search"
                            style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                        />
                        <PillButton label={t('servers.check')} variant="secondary" onPress={check} disabled={!domain} loading={checking} />
                    </View>
                    <Text style={[type.meta, { color: colors.textMuted }]}>{t('servers.addressHint')}</Text>
                </View>

                {!!problem && (
                    <Text accessibilityRole="alert" style={[type.body, { color: colors.textSecondary }]}>{problem}</Text>
                )}

                {result?.ok && (
                    <Card style={styles.preview}>
                        {!!result.server.thumbnail && (
                            <Image source={{ uri: result.server.thumbnail }} style={[styles.thumbnail, { backgroundColor: colors.inputBackground }]} resizeMode="cover" />
                        )}
                        <View style={styles.previewText}>
                            <Text style={[type.name, { color: colors.textPrimary }]}>{result.server.title}</Text>
                            <Text style={[type.meta, { color: colors.textMuted }]}>{result.server.domain}</Text>
                            {!!result.server.description && (
                                <Text style={[type.body, { color: colors.textSecondary }]} numberOfLines={4}>{result.server.description}</Text>
                            )}
                        </View>
                        <View style={styles.buttons}>
                            <PillButton label={t('servers.pin')} icon="add" onPress={pin} loading={pinning} />
                            <PillButton label={t('servers.preview')} icon="eye-outline" variant="secondary" onPress={preview} />
                        </View>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    spacer: {
        width: 44,
    },
    content: {
        gap: space.lg,
        padding: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    field: {
        gap: space.xs,
    },
    label: {
        marginHorizontal: space.xs,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    input: {
        flex: 1,
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    preview: {
        gap: space.md,
    },
    thumbnail: {
        width: '100%',
        aspectRatio: 2,
        borderRadius: radii.well,
    },
    previewText: {
        gap: 2,
    },
    buttons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
});

export default ServerPicker;

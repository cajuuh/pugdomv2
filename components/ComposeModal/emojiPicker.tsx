import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomEmojis } from '../../services/mastodon/customEmojis';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { BottomSheet } from './optionSheet';
import { makeStyles } from './styles';

const COLUMNS = 7;

interface EmojiPickerProps {
    visible: boolean;
    onPick: (shortcode: string) => void;
    onClose: () => void;
}

// The instance's custom emoji; picking one inserts its :shortcode:
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onPick, onClose }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['customEmojis'],
        queryFn: fetchCustomEmojis,
        staleTime: 60 * 60 * 1000,
        enabled: visible,
    });
    const emojis = useMemo(() => (data ?? []).filter(emoji => emoji.visible_in_picker), [data]);

    const status = isLoading
        ? <ActivityIndicator color={colors.accentColor} />
        : isError
            ? <Text style={[type.meta, styles.emojiStatusText]}>Couldn't load this server's emoji</Text>
            : emojis.length === 0
                ? <Text style={[type.meta, styles.emojiStatusText]}>This server has no custom emoji</Text>
                : null;

    return (
        <BottomSheet visible={visible} title="Custom emoji" onClose={onClose}>
            {status ? (
                <View style={styles.emojiStatus}>{status}</View>
            ) : (
                <FlatList
                    data={emojis}
                    keyExtractor={emoji => emoji.shortcode}
                    numColumns={COLUMNS}
                    style={styles.emojiGrid}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => {
                                onPick(item.shortcode);
                                onClose();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`:${item.shortcode}:`}
                            style={({ pressed }) => [styles.emojiCell, pressed && styles.optionSelected]}
                        >
                            <Image source={{ uri: item.static_url || item.url }} style={styles.emojiImage} resizeMode="contain" />
                        </Pressable>
                    )}
                />
            )}
        </BottomSheet>
    );
};

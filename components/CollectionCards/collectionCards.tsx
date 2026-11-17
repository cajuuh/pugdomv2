import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { Collection } from '../../services/mastodon/types';
import { radii, space } from '../../services/theme/shape';
import { Card, SectionLabel } from '../ui';
import { Icon } from '../ui/icon';

interface CollectionCardsProps {
    collections: Collection[];
    onOpen: (collection: Collection) => void;
    // The profile's side padding, so the row can scroll edge to edge
    gutter: number;
    // Your own profile: a card that makes a new collection, shown even before you have any
    onCreate?: () => void;
}

const CARD_WIDTH = 200;

// A profile's collections (Mastodon 4.6): a sideways row of cards under the bio, each opening its people
export const CollectionCards: React.FC<CollectionCardsProps> = ({ collections, onOpen, gutter, onCreate }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    if (!collections.length && !onCreate) return null;

    return (
        <View style={styles.section}>
            <SectionLabel style={styles.label}>{t('collections.title')}</SectionLabel>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -gutter }}
                contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
            >
                {collections.map(collection => {
                    const count = tn('collections.accounts', collection.item_count);
                    return (
                        <Pressable
                            key={collection.id}
                            testID="collection-card"
                            onPress={() => onOpen(collection)}
                            accessibilityRole="button"
                            accessibilityLabel={`${collection.name}, ${count}`}
                            style={({ pressed }) => pressed && { opacity: 0.7 }}
                        >
                            <Card style={styles.card}>
                                <View style={styles.top}>
                                    <Icon name="layers-outline" size={16} color={colors.accentText} />
                                    <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>
                                        {count}
                                    </Text>
                                </View>
                                <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={2}>
                                    {collection.name}
                                </Text>
                                {!!collection.tag && (
                                    <Text style={[type.meta, { color: colors.accentText }]} numberOfLines={1}>
                                        #{collection.tag.name}
                                    </Text>
                                )}
                                {/* Only yours can be unlisted: others never see those on a profile */}
                                {!collection.discoverable && (
                                    <View style={styles.top}>
                                        <Icon name="lock-closed-outline" size={13} color={colors.textMuted} />
                                        <Text style={[type.meta, { color: colors.textMuted }]}>{t('collections.unlisted')}</Text>
                                    </View>
                                )}
                            </Card>
                        </Pressable>
                    );
                })}
                {onCreate && (
                    <Pressable
                        onPress={onCreate}
                        accessibilityRole="button"
                        accessibilityLabel={t('collections.new')}
                        style={({ pressed }) => pressed && { opacity: 0.7 }}
                    >
                        <View style={[styles.card, styles.create, { borderColor: colors.borderColor }]}>
                            <Icon name="add-circle-outline" size={22} color={colors.accentText} />
                            <Text style={[type.name, { color: colors.accentText }]}>{t('collections.new')}</Text>
                        </View>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        // On top of the profile info's own gap
        marginTop: space.xs,
    },
    label: {
        marginBottom: space.sm,
    },
    row: {
        gap: space.md,
    },
    card: {
        width: CARD_WIDTH,
        padding: space.md,
        gap: space.xs,
        borderRadius: radii.well,
    },
    // Dashed, so it reads as a place to add one rather than a collection
    create: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
});

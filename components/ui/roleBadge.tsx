import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { contrast } from '../../services/theme/coats';
import { AccountRole } from '../../services/mastodon/types';
import { radii, space } from '../../services/theme/shape';
import { PugMark } from './pugMark';

// Roles for people who back their server: they get the happy pug
const SUPPORTER = /support|apoi|patron|patroc|donor|doador|doadora|backer|sponsor|funder/i;
export const isSupporterRole = (name: string) => SUPPORTER.test(name);

// The role's own colour when it reads well on the badge, else the coat's
export const roleTextColor = (color: string | undefined, background: string, fallback: string) =>
    color && /^#[0-9a-f]{6}$/i.test(color) && contrast(color, background) >= 4.5 ? color : fallback;

// A role the server highlights on someone ("Admin", "Server supporter"), as a small pill
export const RoleBadge: React.FC<{ role: AccountRole }> = ({ role }) => {
    const { colors, type, coat } = useTheme();
    const { t } = useI18n();
    const supporter = isSupporterRole(role.name);

    return (
        <View
            style={[styles.badge, { backgroundColor: colors.inputBackground }]}
            accessible
            accessibilityLabel={t('profile.role', { name: role.name })}
        >
            {supporter && <PugMark coat={coat} size={16} mood="happy" />}
            <Text style={[type.label, styles.text, { color: roleTextColor(role.color, colors.inputBackground, colors.accentText) }]} numberOfLines={1}>
                {role.name}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingVertical: 3,
        paddingHorizontal: space.sm,
        borderRadius: radii.pill,
    },
    text: {
        fontSize: 10.5,
    },
});

import React, { useState } from 'react';
import { Platform, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '../../components/ui/icon';
import { useTheme } from '../../services/themeContext';
import { useNavigator } from '../../services/navigationContext';
import { Account, Attachment, Relationship } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { PARAGRAPH_GAP, StatusHtmlContent, openLink } from '../../components/TootCard/htmlContent';
import { Avatar, IconButton, PillButton, PugMark, RoleBadge, SegmentOption, SegmentedPill } from '../../components/ui';
import { FollowButton } from '../../components/FollowButton/followButton';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { MIN_TOUCH, hitSlopFor, space } from '../../services/theme/shape';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { AVATAR_SIZE, BANNER_HEIGHT, SHARE_SIZE, makeStyles } from './styles';
import { AccountListsSheet } from '../../components/AccountListsSheet/accountListsSheet';
import { ActionSheet } from '../../components/ComposeModal/optionSheet';
import { useModeration } from '../../hooks/useModeration';
import { useMediaViewer } from '../../components/MediaViewer/mediaViewer';
import { useNotifyOff, useNotifyOn } from '../../hooks/useRelationships';
import { dialog } from '../../services/dialog';

const originOf = (url?: string) => url?.match(/^https?:\/\/[^/?#]+/i)?.[0];

// "@user@instance": your own account's acct has no domain, so take it from the profile URL
export const fullHandle = (account: Account) => {
    if (account.acct.includes('@')) return `@${account.acct}`;
    const domain = originOf(account.url)?.replace(/^https?:\/\//i, '');
    return domain ? `@${account.acct}@${domain}` : `@${account.acct}`;
};

// Mastodon serves a placeholder image (".../missing.png") when there's no header
const hasHeaderImage = (account: Account) => !!account.header && !account.header.includes('missing');

interface ProfileHeaderProps<T extends string> {
    user: Account;
    // Your own profile (edit, settings) or someone else's (back, follow)
    mode: 'self' | 'other';
    tabs: SegmentOption<T>[];
    tab: T;
    onChangeTab: (tab: T) => void;
    onSettingsPress?: () => void;
    onBack?: () => void;
    relationship?: Relationship;
    // Space for the status bar when the profile is drawn full screen
    topInset?: number;
}

export function ProfileHeader<T extends string>({ user, mode, tabs, tab, onChangeTab, onSettingsPress, onBack, relationship, topInset = 0 }: ProfileHeaderProps<T>) {
    const { colors, type, coat } = useTheme();
    const { t, locale } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const { width } = useWindowDimensions();
    const { openMention, openHashtag, openLinkInApp } = useOpenAccount();
    const name = user.display_name || user.username;
    const [listsOpen, setListsOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const moderation = useModeration();
    const remoteServer = mode === 'other' && user.acct.includes('@') ? user.acct.split('@').pop() : undefined;
    const notifyOn = useNotifyOn();
    const notifyOff = useNotifyOff();
    const [bellBusy, setBellBusy] = useState(false);
    // The bell: their posts as notifications. Only for people you follow
    const toggleBell = async () => {
        const turningOn = !relationship?.notifying;
        setBellBusy(true);
        try {
            await (turningOn ? notifyOn(user.id) : notifyOff(user.id));
            dialog.toast(t(turningOn ? 'profile.notifyOnDone' : 'profile.notifyOffDone', { name }));
        } catch (error) {
            console.warn('Changing the bell failed:', error);
            dialog.toast(t('profile.notifyFailed'));
        } finally {
            setBellBusy(false);
        }
    };

    const { push } = useNavigator();
    const { openMedia } = useMediaViewer();
    // The profile picture or header, full size in the viewer (zoom, swipe to close)
    const viewImage = (url: string) => openMedia([{ id: url, type: 'image', url, preview_url: url } as Attachment], 0);
    const handleEditProfile = () => push({ name: 'editProfile' });
    const note = relationship?.note ?? '';
    const editNote = () => push({ name: 'accountNote', account: user, note });

    const handleShare = async () => {
        if (!user.url) return;
        try {
            await Share.share({ message: t('profile.shareMessage', { url: user.url }) });
        } catch (error: any) {
            dialog.alert(t('profile.shareFailed'), error.message);
        }
    };

    const stat = (count: number | undefined, label: string) => (
        <Text style={[type.body, styles.stat]}>
            <Text style={[type.name, styles.statNumber]}>{(count ?? 0).toLocaleString(locale)}</Text> {label}
        </Text>
    );
    // Following and followers open the list of those people
    const followStat = (list: 'following' | 'followers', count: number | undefined, label: string) => (
        <Pressable
            onPress={() => push({ name: 'follows', accountId: user.id, list, account: user })}
            accessibilityRole="button"
            accessibilityLabel={`${(count ?? 0).toLocaleString(locale)} ${label}`}
            hitSlop={hitSlopFor(MIN_TOUCH, 19)}
        >
            {stat(count, label)}
        </Pressable>
    );

    return (
        <View style={styles.header}>
            <View style={[styles.banner, topInset > 0 && { height: BANNER_HEIGHT + topInset }]}>
                {hasHeaderImage(user) ? (
                    <Pressable onPress={() => viewImage(user.header!)} accessibilityRole="imagebutton" accessibilityLabel={t('profile.viewHeader', { name })}>
                        <Image testID="profile-banner-image" source={{ uri: user.header }} style={styles.bannerImage} contentFit="cover" />
                    </Pressable>
                ) : (
                    <View testID="profile-banner-mark" style={styles.bannerMark}>
                        <PugMark coat={coat} size={220} />
                    </View>
                )}
                {onBack && (
                    <IconButton
                        icon="arrow-back"
                        accessibilityLabel={t('account.back')}
                        onPress={onBack}
                        style={[styles.bannerButton, styles.bannerButtonLeft, { top: topInset + space.md }]}
                    />
                )}
                {/* Share, report, mute, block: on the banner, where your own profile has Settings, so the row
                    below keeps room for Follow, the bell and lists */}
                {mode === 'other' && (
                    <IconButton
                        icon="ellipsis-horizontal"
                        accessibilityLabel={t('moderation.profileMenu', { name })}
                        onPress={() => setMenuOpen(true)}
                        style={[styles.bannerButton, { top: topInset + space.md }]}
                    />
                )}
                {mode === 'self' && onSettingsPress && (
                    <IconButton
                        icon="options-outline"
                        accessibilityLabel={t('common.settings')}
                        onPress={onSettingsPress}
                        style={[styles.bannerButton, { top: topInset + space.md }]}
                    />
                )}
            </View>

            <View style={styles.info}>
                <View style={styles.avatarRow}>
                    <Pressable
                        onPress={() => user.avatar && viewImage(user.avatar)}
                        disabled={!user.avatar}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={t('profile.viewAvatar', { name })}
                        style={styles.avatarRing}
                    >
                        <Avatar name={name} uri={user.avatar} size={AVATAR_SIZE} />
                    </Pressable>
                    <View style={styles.actions}>
                        {mode === 'self' ? (
                            <PillButton label={t('profile.editProfile')} variant="secondary" onPress={handleEditProfile} />
                        ) : (
                            <FollowButton accountId={user.id} name={name} relationship={relationship} allowUnfollow size="medium" />
                        )}
                        {mode === 'other' && relationship?.following && (
                            <Pressable
                                onPress={toggleBell}
                                disabled={bellBusy}
                                accessibilityRole="switch"
                                accessibilityState={{ checked: !!relationship.notifying, busy: bellBusy }}
                                accessibilityLabel={t('profile.notify', { name })}
                                hitSlop={hitSlopFor(SHARE_SIZE, SHARE_SIZE)}
                                style={({ pressed }) => [styles.share, relationship.notifying && { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                            >
                                <Icon
                                    name={relationship.notifying ? 'notifications' : 'notifications-outline'}
                                    size={18}
                                    color={relationship.notifying ? colors.accentText : colors.textPrimary}
                                />
                            </Pressable>
                        )}
                        {mode === 'other' && relationship && (
                            <Pressable
                                onPress={() => setListsOpen(true)}
                                accessibilityRole="button"
                                accessibilityLabel={t('lists.addToListsLabel', { name })}
                                hitSlop={hitSlopFor(SHARE_SIZE, SHARE_SIZE)}
                                style={({ pressed }) => [styles.share, pressed && { opacity: 0.7 }]}
                            >
                                <Icon name="list-outline" size={18} color={colors.textPrimary} />
                            </Pressable>
                        )}
                        {/* On other people's profiles share is in the ⋯ menu: Follow, the bell and lists already fill
                            the row, and a fourth button was cut off on narrow phones */}
                        {mode === 'self' && (
                            <Pressable
                                onPress={handleShare}
                                accessibilityRole="button"
                                accessibilityLabel={t('profile.shareProfile')}
                                hitSlop={hitSlopFor(SHARE_SIZE, SHARE_SIZE)}
                                style={({ pressed }) => [styles.share, pressed && { opacity: 0.7 }]}
                            >
                                <Icon name="share-outline" size={18} color={colors.textPrimary} />
                            </Pressable>
                        )}
                    </View>
                </View>

                <View style={styles.names}>
                    <Text accessibilityRole="header" style={[type.title, styles.name]} numberOfLines={2}>
                        {renderTextWithEmojis(name, user.emojis || [], [type.title, styles.name], 24)}
                    </Text>
                    <Text style={[type.meta, styles.handle]} numberOfLines={1}>{fullHandle(user)}</Text>
                </View>

                {!!user.roles?.length && (
                    <View style={styles.roles}>
                        {user.roles.map(role => <RoleBadge key={role.id} role={role} />)}
                    </View>
                )}

                {mode === 'other' && ((relationship?.followed_by && !relationship.following) || remoteServer) && (
                    <View style={styles.otherInfo}>
                        {relationship?.followed_by && !relationship.following && (
                            <View style={styles.followsYou}>
                                <Text style={[type.label, styles.followsYouText]}>{t('account.followsYou')}</Text>
                            </View>
                        )}
                        {remoteServer && !!user.url && (
                            <Pressable
                                onPress={() => openLink(user.url!)}
                                accessibilityRole="link"
                                accessibilityLabel={t('account.openOnServer', { server: remoteServer })}
                                hitSlop={hitSlopFor(0, 20)}
                                style={({ pressed }) => [styles.remoteLink, pressed && { opacity: 0.7 }]}
                            >
                                <Icon name="open-outline" size={14} color={colors.accentText} />
                                <Text style={[type.meta, styles.remoteLinkText]}>{t('account.openOnServer', { server: remoteServer })}</Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {!!user.note && (
                    // Takes back the last paragraph's margin, so the space below the bio is the same as elsewhere
                    <View style={{ marginBottom: -PARAGRAPH_GAP }}>
                        <StatusHtmlContent
                            content={user.note}
                            emojis={user.emojis}
                            colors={colors}
                            bodyFont={type.body}
                            compactMode={false}
                            width={width - 40}
                            onPressMention={openMention}
                            onPressHashtag={openHashtag}
                            onPressLink={openLinkInApp}
                        />
                    </View>
                )}

                {/* The profile's fields (pronouns, links...): a verified link (rel="me") is ticked in the coat accent */}
                {!!user.fields?.length && (
                    <View style={styles.fields}>
                        {user.fields.map((field, i) => (
                            <View
                                key={`${field.name}-${i}`}
                                testID={field.verified_at ? 'profile-field-verified' : 'profile-field'}
                                style={[styles.field, i > 0 && styles.fieldDivider, !!field.verified_at && { backgroundColor: colors.accentSoft }]}
                            >
                                <Text style={[type.label, styles.fieldName]}>
                                    {renderTextWithEmojis(field.name, user.emojis || [], [type.label, styles.fieldName], 16)}
                                </Text>
                                <View style={styles.fieldValue}>
                                    {!!field.verified_at && (
                                        <Icon name="checkmark-circle" size={16} color={colors.accentText} accessibilityLabel={t('profile.verifiedLink')} />
                                    )}
                                    <View style={styles.fieldValueText}>
                                        <StatusHtmlContent
                                            content={field.value}
                                            emojis={user.emojis}
                                            colors={colors}
                                            bodyFont={type.body}
                                            compactMode={false}
                                            width={width - 40 - 2 * space.md - (field.verified_at ? 16 + space.xs : 0)}
                                            onPressMention={openMention}
                                            onPressHashtag={openHashtag}
                                            onPressLink={openLinkInApp}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Your private note on them: tap to change it; without one, it's added from the ⋯ menu */}
                {mode === 'other' && !!note && (
                    <Pressable
                        onPress={editNote}
                        accessibilityRole="button"
                        accessibilityLabel={t('profile.noteLabel', { name, note })}
                        style={({ pressed }) => [styles.note, pressed && { opacity: 0.7 }]}
                    >
                        <View style={styles.noteTop}>
                            <Icon name="document-text-outline" size={14} color={colors.accentText} />
                            <Text style={[type.label, styles.noteLabel]}>{t('profile.note')}</Text>
                            <Icon name="create-outline" size={14} color={colors.textMuted} />
                        </View>
                        <Text style={[type.body, styles.noteText]}>{note}</Text>
                    </Pressable>
                )}

                <View style={styles.stats}>
                    {stat(user.statuses_count, t('profile.statPosts'))}
                    {followStat('following', user.following_count, t('profile.statFollowing'))}
                    {followStat('followers', user.followers_count, t('profile.statFollowers'))}
                </View>
            </View>

            <View style={styles.tabs}>
                <SegmentedPill variant="underline" options={tabs} value={tab} onChange={onChangeTab} />
            </View>
            {mode === 'other' && (
                <AccountListsSheet visible={listsOpen} onClose={() => setListsOpen(false)} account={user} following={!!relationship?.following} />
            )}
            {mode === 'other' && (
                <ActionSheet
                    visible={menuOpen}
                    title={t('moderation.moreOptions')}
                    subtitle={`@${user.acct}`}
                    onClose={() => setMenuOpen(false)}
                    actions={[
                        // After the sheet has closed: iOS can't present the share sheet over one still closing
                        { key: 'share', icon: 'share-outline', label: t('profile.shareProfile'), onPress: () => setTimeout(handleShare, Platform.OS === 'ios' ? 400 : 0) },
                        ...(relationship?.followed_by
                            ? [{ key: 'removeFollower', icon: 'person-remove-outline' as const, label: t('moderation.removeFollower', { acct: user.acct }), description: t('moderation.removeFollowerHint'), onPress: () => moderation.removeFollower(user) }]
                            : []),
                        ...(relationship
                            ? [{ key: 'note', icon: 'document-text-outline' as const, label: t(note ? 'profile.editNote' : 'profile.addNote'), onPress: editNote }]
                            : []),
                        { key: 'report', icon: 'flag-outline', label: t('moderation.reportAccount', { acct: user.acct }), onPress: () => moderation.report(user) },
                        relationship?.muting
                            ? { key: 'unmute', icon: 'volume-high-outline', label: t('moderation.unmuteAccount', { acct: user.acct }), onPress: () => moderation.unmute(user) }
                            : { key: 'mute', icon: 'volume-mute-outline', label: t('moderation.muteAccount', { acct: user.acct }), description: t('moderation.muteHint'), onPress: () => moderation.mute(user) },
                        relationship?.blocking
                            ? { key: 'unblock', icon: 'hand-left', label: t('moderation.unblockAccount', { acct: user.acct }), onPress: () => moderation.unblock(user) }
                            : { key: 'block', icon: 'hand-left-outline', label: t('moderation.blockAccount', { acct: user.acct }), description: t('moderation.blockHint'), onPress: () => moderation.block(user) },
                    ]}
                />
            )}
        </View>
    );
}

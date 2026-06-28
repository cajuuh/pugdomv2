import React from 'react';
import { StyleSheet, ScrollView, Dimensions, Alert, Image, Share } from 'react-native';
import { View, Text, Button, Avatar, Card } from 'react-native-ui-lib';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { styles } from './styles'
import { renderTextWithEmojis } from '../../components/TootCard/tootCard';

const { width } = Dimensions.get('window');

const stripHtml = (html: string) => {
    if (!html) {
        return '';
    }
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, '').trim();
}

const Profile = () => {
    const { user, logout } = useAuth();
    const { colors } = useTheme();

    if (!user) {
        return null;
    }

    const formattedBio = stripHtml(user.note || '');

    const handleOpenWeb = async () => {
        if (user.url) {
            await WebBrowser.openBrowserAsync(user.url);
        }
    }

    const handleShare = async () => {
        if (user.url) {
            try {
                await Share.share({
                    message: `Check out my Mastodon profile on pugdom: ${user.url}`
                })
            } catch (error: any) {
                Alert.alert('Error sharing profile', error.message);
            }
        }
    };

    const checkHeader = () => {
        if (user.header && !user.header.includes('missing')) {
            return (
                <Image source={{ uri: user.header }} style={styles.headerBanner} />
            )
        }
        return (
            <View style={[styles.headerBanner, styles.gradientFallback]} />
        )
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* header */}
            <View style={[styles.headerBannerContainer, { backgroundColor: colors.cardBackground }]}>
                {checkHeader()}
            </View>
            {/* profiel info */}
            <View style={styles.profileInfoContainer}>
                {/* avatar */}
                <View style={styles.avatarWrapper}>
                    <Avatar source={{ uri: user.avatar }} size={90} containerStyle={[styles.avatarBorder, { borderColor: colors.background }]} />
                </View>
                {/* names */}
                {renderTextWithEmojis(
                    user.display_name || user.username,
                    user.emojis || [],
                    [styles.displayName, { color: colors.textPrimary }],
                    20
                )}
                <Text style={[styles.username, { color: colors.textSecondary }]}>@{user.username}</Text>
                {/* stats */}
                <View style={styles.statsGrid}>
                    <Card style={[styles.statsCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                        <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                            {user.statuses_count?.toLocaleString() || '0'}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
                    </Card>
                    <Card style={[styles.statsCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                        <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{user.following_count?.toLocaleString() || '0'}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                    </Card>
                    <Card style={[styles.statsCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                        <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{user.followers_count?.toLocaleString() || '0'}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                    </Card>
                </View>
                {formattedBio ? (
                    <View style={[styles.bioContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                        <Text style={[styles.bioTitle, { color: colors.accentColor }]}>
                            About Me
                        </Text>
                        <Text style={[styles.bioText, { color: colors.textPrimary }]}>
                            {formattedBio}
                        </Text>
                    </View>
                ) : null}
                <View style={styles.actionButtonsContainer}>
                    <Button
                        label="View on web"
                        size={Button.sizes.medium}
                        backgroundColor={colors.accentColor}
                        style={styles.actionButton}
                        onPress={handleOpenWeb}
                        labelStyle={styles.buttonLabel}
                    />
                    <Button
                        label="Share Profile"
                        size={Button.sizes.medium}
                        outline
                        outlineColor={colors.borderColor}
                        style={[styles.actionButton, styles.outlineButton]}
                        onPress={handleShare}
                        labelStyle={[styles.buttonLabel, { color: colors.textPrimary }]}
                    />
                </View>
                <Button
                    label="Log Out"
                    link
                    color={colors.dangerColor}
                    style={styles.logoutButton}
                    onPress={logout}
                    labelStyle={[styles.logoutLabel, { color: colors.dangerColor }]}
                    iconSource={() => <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} style={{ marginRight: 6 }} />}
                />
            </View>
        </ScrollView>
    );
}

export default Profile;
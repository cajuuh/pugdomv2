import React, { useState } from 'react';
import { StyleSheet, ScrollView, Dimensions, Alert, Image, Share, RefreshControl } from 'react-native';
import { View, Text, Button, Avatar, Card } from 'react-native-ui-lib';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { renderTextWithEmojis } from '../../services/emojiHelper';

const { width } = Dimensions.get('window');

const stripHtml = (html: string) => {
    if (!html) {
        return '';
    }
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, '').trim();
}

const Profile = () => {
    const { user, logout, checkLoginStatus } = useAuth();
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [refreshing, setRefreshing] = useState(false);

    if (!user) {
        return null;
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await checkLoginStatus();
        } finally {
            setRefreshing(false);
        }
    };

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
        <ScrollView 
            style={styles.container} 
            contentContainerStyle={styles.contentContainer} 
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.accentColor}
                    colors={[colors.accentColor]}
                />
            }
        >
            {/* header */}
            <View style={styles.headerBannerContainer}>
                {checkHeader()}
            </View>
            {/* profiel info */}
            <View style={styles.profileInfoContainer}>
                {/* avatar */}
                <View style={styles.avatarWrapper}>
                    <Avatar source={{ uri: user.avatar }} size={90} containerStyle={styles.avatarBorder} />
                </View>
                {/* names */}
                {renderTextWithEmojis(
                    user.display_name || user.username,
                    user.emojis || [],
                    styles.displayName,
                    20
                )}
                <Text style={styles.username}>@{user.acct}</Text>
                {/* stats */}
                <View style={styles.statsGrid}>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>
                            {user.statuses_count?.toLocaleString() || '0'}
                        </Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </Card>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>{user.following_count?.toLocaleString() || '0'}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </Card>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>{user.followers_count?.toLocaleString() || '0'}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </Card>
                </View>
                {formattedBio ? (
                    <View style={styles.bioContainer}>
                        <Text style={styles.bioTitle}>
                            About Me
                        </Text>
                        <Text style={styles.bioText}>
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
                        labelStyle={[styles.buttonLabel, { color: colors.buttonTextColor }]}
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
                    onPress={() => logout()}
                    labelStyle={[styles.logoutLabel, { color: colors.dangerColor }]}
                    iconSource={() => <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} style={{ marginRight: 6 }} />}
                />
            </View>
        </ScrollView>
    );
}

export default Profile;
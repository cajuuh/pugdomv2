import React from 'react';
import { StyleSheet, ScrollView, Dimensions, Alert, Image, Share } from 'react-native';
import { View, Text, Button, Avatar, Card } from 'react-native-ui-lib';
import { useAuth } from '../../services/authContext';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { styles } from './styles'

const { width } = Dimensions.get('window');

const stripHtml = (html: string) => {
    if (!html) {
        return '';
    }
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, '').trim();
}

const Profile = () => {
    const { user, logout } = useAuth();

    if (!user) {
        return null;
    }

    const formattedBio = stripHtml(user.note);

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
                Alert.alert('Error sharing progile', error.message);
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
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.displayName}>
                    {user.display_name || user.username}
                </Text>
                <Text style={styles.username}>@{user.username}</Text>
                {/* stats */}
                <View style={styles.statsGrid}>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>
                            {user.statuses_count.toLocaleString()}
                        </Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </Card>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>{user.following_count.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </Card>
                    <Card style={styles.statsCard} enableShadow={false}>
                        <Text style={styles.statNumber}>{user.followers_count.toLocaleString()}</Text>
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
                        backgroundColor="#6366F1"
                        style={styles.actionButton}
                        onPress={handleOpenWeb}
                        labelStyle={styles.buttonLabel}
                    />
                    <Button
                        label="Share Profile"
                        size={Button.sizes.medium}
                        outline
                        outlineColor="#475569"
                        style={[styles.actionButton, styles.outlineButton]}
                        onPress={handleShare}
                        labelStyle={[styles.buttonLabel, { color: '#E2E8F0' }]}
                    />
                </View>
                <Button
                    label="Log Out"
                    link
                    color="#EF4444"
                    style={styles.logoutButton}
                    onPress={logout}
                    labelStyle={styles.logoutLabel}
                    iconSource={() => <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />}
                />
            </View>
        </ScrollView>
    );
}

export default Profile;
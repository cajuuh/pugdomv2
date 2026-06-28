import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    TextInput,
    ScrollView,
    Switch,
    TouchableOpacity,
    ActivityIndicator,
    DeviceEventEmitter,
    Alert,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCompose } from '../../services/composeContext';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { createStatus } from '../../services/mastodon/statuses';
import { styles } from './styles';

const stripHtml = (html: string) => {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .trim();
};

const ComposeModal: React.FC = () => {
    const { isOpen, replyToStatus, closeCompose } = useCompose();
    const { user } = useAuth();
    const { colors, isDark } = useTheme();

    const [text, setText] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [spoilerText, setSpoilerText] = useState('');
    const [loading, setLoading] = useState(false);

    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isOpen) {
            if (replyToStatus) {
                setText(`@${replyToStatus.account.username} `);
            } else {
                setText('');
            }
            setSensitive(false);
            setSpoilerText('');
            setLoading(false);
            
            // Short delay to ensure modal is mounted before focusing
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, replyToStatus]);

    if (!isOpen) return null;

    const charLimit = 500;
    const remaining = charLimit - text.length;
    const isOverLimit = remaining < 0;
    const isEmpty = text.trim().length === 0;
    const isPublishDisabled = isEmpty || isOverLimit || loading;

    // Determine character counter color
    let counterColor = colors.textSecondary;
    if (remaining < 50 && remaining >= 0) {
        counterColor = '#F59E0B'; // Warn orange
    } else if (isOverLimit) {
        counterColor = colors.dangerColor; // Error red
    }

    const handlePublish = async () => {
        if (isPublishDisabled) return;
        setLoading(true);
        try {
            await createStatus({
                status: text,
                in_reply_to_id: replyToStatus ? replyToStatus.id : null,
                sensitive,
                spoiler_text: sensitive ? spoilerText : undefined,
            });

            DeviceEventEmitter.emit('status_published');
            closeCompose();
        } catch (error: any) {
            console.error('Failed to post status:', error);
            Alert.alert(
                'Publishing Failed',
                error.response?.data?.error || error.message || 'An error occurred while publishing your status.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={closeCompose}
        >
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
                        <TouchableOpacity onPress={closeCompose} style={styles.headerButton}>
                            <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>

                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                            {replyToStatus ? 'Reply' : 'New Post'}
                        </Text>

                        <TouchableOpacity
                            onPress={handlePublish}
                            disabled={isPublishDisabled}
                            style={[
                                styles.publishButton,
                                { backgroundColor: colors.accentColor },
                                isPublishDisabled && styles.publishButtonDisabled
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.publishButtonText, { color: '#FFFFFF' }]}>Post</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Editor Space */}
                    <ScrollView
                        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Parent Status Preview if Reply */}
                        {replyToStatus && (
                            <View style={[styles.replyPreview, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                                <View style={styles.replyHeader}>
                                    <Avatar source={{ uri: replyToStatus.account.avatar }} size={24} />
                                    <View>
                                        <Text style={[styles.replyDisplayName, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {replyToStatus.account.display_name || replyToStatus.account.username}
                                        </Text>
                                        <Text style={[styles.replyUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                                            @{replyToStatus.account.username}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.replyContent, { color: colors.textSecondary }]} numberOfLines={3}>
                                    {stripHtml(replyToStatus.content)}
                                </Text>
                            </View>
                        )}

                        {/* Author Info */}
                        {user && (
                            <View style={styles.authorSection}>
                                <Avatar source={{ uri: user.avatar }} size={36} />
                                <View>
                                    <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                                        {user.display_name || user.username}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Sensitive CW field */}
                        {sensitive && (
                            <View style={styles.spoilerInputContainer}>
                                <TextInput
                                    style={[
                                        styles.spoilerInput,
                                        {
                                            backgroundColor: colors.cardBackground,
                                            borderColor: colors.borderColor,
                                            color: colors.textPrimary
                                        }
                                    ]}
                                    placeholder="Write your content warning here..."
                                    placeholderTextColor={colors.textMuted}
                                    value={spoilerText}
                                    onChangeText={setSpoilerText}
                                    maxLength={100}
                                />
                            </View>
                        )}

                        {/* Compose Text Field */}
                        <TextInput
                            ref={inputRef}
                            style={[styles.textArea, { color: colors.textPrimary }]}
                            placeholder={replyToStatus ? "Write your reply..." : "What's on your mind?"}
                            placeholderTextColor={colors.textMuted}
                            multiline={true}
                            value={text}
                            onChangeText={setText}
                            maxLength={600} // Give slightly more than limit so user sees overflow count
                        />

                        {/* Composer settings / toggles */}
                        <View style={[styles.settingsContainer, { borderTopColor: colors.borderColor }]}>
                            <View style={styles.settingRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="eye-off-outline" size={20} color={colors.accentColor} />
                                    <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                                        Sensitive Content
                                    </Text>
                                </View>
                                <Switch
                                    value={sensitive}
                                    onValueChange={setSensitive}
                                    trackColor={{ false: colors.borderColor, true: colors.accentColor }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor }]}>
                        <Text style={[styles.charCounter, { color: counterColor }]}>
                            {remaining}
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

export default ComposeModal;

import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    TextInput,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    DeviceEventEmitter,
    Alert,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
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

const LANGUAGES = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'es-ES', label: 'Español (España)' },
    { code: 'fr-FR', label: 'Français (France)' },
    { code: 'de-DE', label: 'Deutsch (Deutschland)' },
];

import { Status } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../TootCard/tootCard';

interface ComposeModalProps {
    isOpen: boolean;
    replyToStatus: Status | null;
    closeCompose: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, replyToStatus, closeCompose }) => {
    const { user } = useAuth();
    const { colors } = useTheme();

    const [text, setText] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [spoilerText, setSpoilerText] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Helper States
    const [language, setLanguage] = useState('en-US');
    const [langModalVisible, setLangModalVisible] = useState(false);

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
            setLanguage('en-US');
            setLoading(false);
            
            // Focus on mount/open
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
                language: language,
                visibility: replyToStatus ? replyToStatus.visibility : 'public',
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
            <SafeAreaProvider>
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

                    {/* Helper Input Bar (Language selection only) */}
                    <View style={[styles.helperBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
                        {(() => {
                            const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
                            return (
                                <TouchableOpacity
                                    style={[styles.langPill, { backgroundColor: colors.background, borderColor: colors.borderColor }]}
                                    onPress={() => setLangModalVisible(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="globe-outline" size={13} color={colors.accentColor} />
                                    <Text style={[styles.langPillText, { color: colors.textPrimary }]}>
                                        {selectedLang.code}
                                    </Text>
                                    <Ionicons name="chevron-down" size={10} color={colors.textSecondary} />
                                </TouchableOpacity>
                            );
                        })()}
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
                                            {renderTextWithEmojis(
                                                replyToStatus.account.display_name || replyToStatus.account.username,
                                                replyToStatus.account.emojis,
                                                styles.replyDisplayName
                                            )}
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
                                        {renderTextWithEmojis(
                                            user.display_name || user.username,
                                            user.emojis,
                                            styles.authorName
                                        )}
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
                            maxLength={600}
                        />
                    </ScrollView>

                    {/* Bottom Accessory Bar */}
                    <View style={[styles.footer, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor }]}>
                        <View style={styles.leftAccessoryRow}>
                            {/* Media selector button */}
                            <TouchableOpacity
                                style={styles.accessoryButton}
                                onPress={() => Alert.alert('Add Media', 'Media attachments feature coming soon!')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {/* Sensitive / CW eye toggle button */}
                            <TouchableOpacity
                                style={styles.accessoryButton}
                                onPress={() => setSensitive(!sensitive)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={sensitive ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={sensitive ? colors.accentColor : colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Character count */}
                        <Text style={[styles.charCounter, { color: counterColor }]}>
                            {remaining}
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </SafeAreaProvider>

            {/* Language Selection Modal Sheet */}
            <Modal
                visible={langModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setLangModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.langModalContainer}
                    activeOpacity={1}
                    onPress={() => setLangModalVisible(false)}
                >
                    <View style={[styles.langSheet, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.langSheetHeader}>
                            <Text style={[styles.langSheetTitle, { color: colors.textPrimary }]}>
                                Select Post Language
                            </Text>
                            <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {LANGUAGES.map((item) => (
                            <TouchableOpacity
                                key={item.code}
                                style={[
                                    styles.langOption,
                                    { backgroundColor: language === item.code ? colors.background : 'transparent' }
                                ]}
                                onPress={() => {
                                    setLanguage(item.code);
                                    setLangModalVisible(false);
                                }}
                            >
                                <Text style={[styles.langOptionText, { color: colors.textPrimary }]}>
                                    {item.label} ({item.code})
                                </Text>
                                {language === item.code && (
                                    <Ionicons name="checkmark-sharp" size={16} color={colors.accentColor} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </Modal>
    );
};

export default ComposeModal;

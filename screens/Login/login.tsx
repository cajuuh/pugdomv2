import React,{useState } from 'react'
import { ScrollView, StyleSheet,Text,TextInput,useWindowDimensions,View } from 'react-native'
import { PillButton, PugMark} from '../../components/ui'
import { radii,space} from '../../services/theme/shape'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

// services
import { registerOnServer, ServerError } from '../../services/mastodon/apps'
import { exchangeCodeForToken } from '../../services/mastodon/auth'
import { saveCredentials } from '../../services/storage'
import { getCurrentAccount } from '../../services/mastodon/accounts'
import { useAuth } from '../../services/authContext'
import { useTheme } from '../../services/themeContext'
import { useI18n } from '../../services/i18n/i18nContext';
import { dialog } from '../../services/dialog';
import { useKeyboard } from '../../hooks/useKeyboard';

// web browser helper to complete authorizations on Android/Web
WebBrowser.maybeCompleteAuthSession();

interface LoginProps {
    onCancel?: () => void;
}

const Login: React.FC<LoginProps> = ({ onCancel }) => {
    const [instance, setInstance] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [focused,setFocused] = useState<boolean>(false);
    const { login } = useAuth();
    const { colors,type,coat } = useTheme();
    const { t } = useI18n();
    // The app draws edge to edge, so the window doesn't shrink for the keyboard: make room for it
    const keyboard = useKeyboard(useWindowDimensions().height);

    const handleLogin = async () => {
        if (!instance.trim()) {
            dialog.alert(t('common.error'), t('login.enterInstance'));
            return;
        }
        setLoading(true);
        try {
            let formattedInstance = instance.trim().toLowerCase();
            if (!/^https?:\/\//i.test(formattedInstance)) {
                formattedInstance = `https://${formattedInstance}`;
            }
            formattedInstance = formattedInstance.replace(/\/+$/, '');

            // login proccess
            const redirectUri = Linking.createURL('redirect');
            const registered = await registerOnServer(formattedInstance, redirectUri);
            formattedInstance = registered.instanceUrl;
            const appData = registered.app;
            const scopes = 'read write follow push';
            const authUrl = `${formattedInstance}/oauth/authorize?client_id=${appData.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;

            // open auth page
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success' && result.url) {
                const code = result.url.split('code=')[1]?.split('&')[0];
                if (!code) {
                    throw new Error('Failed to retrieve auth information from redirect (code)')
                }
                const tokenData = await exchangeCodeForToken(
                    formattedInstance,
                    appData.client_id,
                    appData.client_secret,
                    code,
                    redirectUri
                );
                // save credentials
                await saveCredentials(tokenData.access_token, formattedInstance);

                // get user information
                const account = await getCurrentAccount();
                login(account, tokenData.access_token, formattedInstance);
            }
        } catch (error: any) {
            console.error(error);
            if (error instanceof ServerError && error.reason === 'notMastodon') {
                dialog.alert(t('login.notMastodonTitle'), t('login.notMastodon', { server: error.server }));
            } else if (error instanceof ServerError) {
                dialog.alert(t('login.unreachableTitle'), t('login.unreachable', { server: error.server }));
            } else {
                dialog.alert(t('login.failed'), error.message || t('login.unexpected'));
            }
        } finally {
            setLoading(false);
        }
    };

   return (
        <ScrollView
            style={{ backgroundColor: colors.background }}
            contentContainerStyle={[styles.container, { paddingBottom: keyboard.inset }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.content}>
                <PugMark coat={coat} size={96} />

                <Text
                    style={[
                        type.title,
                        styles.title,
                        { color: colors.textPrimary },
                    ]}
                >
                    pugdon
                </Text>

                <Text
                    style={[
                        type.body,
                        styles.description,
                        { color: colors.textSecondary },
                    ]}
                >
                    {t('login.tagline')}
                </Text>

                <View style={styles.form}>
                    <TextInput
                        value={instance}
                        onChangeText={setInstance}
                        placeholder={t('login.instancePlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        editable={!loading}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        style={[
                            styles.input,
                            {
                                color: colors.textPrimary,
                                backgroundColor: colors.inputBackground,
                                borderColor: focused
                                    ? colors.accentColor
                                    : colors.borderColor,
                            },
                        ]}
                    />

                    <PillButton
                        label={t('common.continue')}
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        style={styles.continueButton}
                    />

                    {onCancel && (
                        <PillButton
                            label={t('common.cancel')}
                            onPress={onCancel}
                            variant="ghost"
                            disabled={loading}
                            style={styles.cancelButton}
                        />
                    )}
                </View>
            </View>
        </ScrollView>
    )
}
const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: space.xl,
    },
    content: {
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
        alignItems: 'center',
    },
    title: {
        marginTop: space.md,
    },
    description: {
        marginTop: space.sm,
        textAlign: 'center',
        maxWidth: 320,
    },
    form: {
        width: '100%',
        marginTop: space.xl,
    },
    input: {
        minHeight: 48,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radii.input,
        paddingHorizontal: space.lg,
        fontSize: 15.5,
    },
    continueButton: {
        marginTop: space.md,
        width: '100%',
    },
    cancelButton: {
        marginTop: space.sm,
        alignSelf: 'center',
    },
})
export default Login;
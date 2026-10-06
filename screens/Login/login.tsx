import React,{useState } from 'react'
import { StyleSheet,Text,TextInput,View } from 'react-native'
import { PillButton, PugMark} from '../../components/ui'
import { radii,space} from '../../services/theme/shape'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

// services
import { registerApp } from '../../services/mastodon/apps'
import { exchangeCodeForToken } from '../../services/mastodon/auth'
import { saveCredentials } from '../../services/storage'
import { getCurrentAccount } from '../../services/mastodon/accounts'
import { useAuth } from '../../services/authContext'
import { useTheme } from '../../services/themeContext'
import { useI18n } from '../../services/i18n/i18nContext';
import { dialog } from '../../services/dialog';

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
            const appData = await registerApp(formattedInstance, redirectUri);
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
            dialog.alert(t('login.failed'), error.message || t('login.unexpected'))
        } finally {
            setLoading(false);
        }
    };

   return (
        <View
            style={[
                styles.container,
                { backgroundColor: colors.background },
            ]}
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
        </View>
    )
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
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
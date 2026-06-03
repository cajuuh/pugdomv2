import { useState, useEffect } from 'react'

// style
import { Alert } from 'react-native'
import { View, Text, TextField, LoaderScreen, Button, Avatar } from 'react-native-ui-lib'

// web
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

// services
import { registerApp } from '../../services/mastodon/apps'
import { exchangeCodeForToken } from '../../services/mastodon/auth'
import { saveCredentials, getCredentials, clearCredentials } from '../../services/storage'
import { getCurrentAccount } from '../../services/mastodon/accounts'

// web browser helper to complete authorizations on Android/Web
WebBrowser.maybeCompleteAuthSession();

const Login = () => {
    const [instance, setInstance] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkLoginStatus();
    }, []);

    const checkLoginStatus = async () => {
        setLoading(true);
        try {
            const credentials = await getCredentials();
            if (credentials.accessToken && credentials.instanceUrl) {
                const account = await getCurrentAccount();
                setUser(account);
            }
        } catch (error) {
            console.error('Failed to check login status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await clearCredentials();
            setUser(null);
            setInstance('');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to log user out.')
        } finally {
            setLoading(false);
        }
    }

    const handleLogin = async () => {
        if (!instance.trim()) {
            Alert.alert('Error', 'Please enter a Mastodon Instance URL');
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
                setUser(account);

                Alert.alert('Success', 'Logged in successfully!')
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Authentication Failed', error.message || 'An unexpected error ocurred.')
        } finally {
            setLoading(false);
        }
    };

    if (user) {
        return (
            <View flex center padding-20>
                <Avatar
                    source={{ uri: user.avatar }}
                    size={80}
                    label={user.username}
                />
                <Text blue50 text40 marginT-s3>
                    Welcome back,
                </Text>
                <Text blue30 text20 marginB-s5>
                    {user.display_name || user.name}
                </Text>
                <Text grey30 marginB-s5>
                    @{user.username}
                </Text>
                <Button
                    label="Log Out"
                    onPress={handleLogout}
                    disabled={loading}
                />
            </View>
        );
    }


    return (
        <View flex center padding-20>
            <Text blue50 text20 marginB-s5>
                Welcome to Pugdom
            </Text>
            <View width="100%" marginT-s5>
                <TextField
                    preset="outline"
                    placeholder="e.g. mastodon.social"
                    onChangeText={setInstance}
                    value={instance}
                    disabled={loading}
                />
            </View>
            {loading ? (
                <LoaderScreen message="Connecting to instance..." marginT-s5 />
            ) : (
                <Button
                    label="Login with Mastodon"
                    marginT-s5
                    onPress={handleLogin}
                />
            )}
        </View>
    )
}

export default Login;
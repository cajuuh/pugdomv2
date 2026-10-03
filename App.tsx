import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, ActivityIndicator, BackHandler, DeviceEventEmitter, TouchableOpacity, Platform, LogBox, View } from 'react-native';

// react-native-image-viewing's default header (the media viewer's close button) still uses React Native's
// deprecated SafeAreaView; the app itself uses react-native-safe-area-context. Remove once that header is replaced.
LogBox.ignoreLogs([
    "SafeAreaView has been deprecated and will be removed in a future release",
]);
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import { ComposeProvider, useCompose } from './services/composeContext';
import { MediaViewerProvider } from './components/MediaViewer/mediaViewer';
import Login from './screens/Login/login';
import Profile from './screens/Profile/profile';
import Timeline from './screens/Timeline/timeline';
import Notifications from './screens/Notifications/notifications';
import Search from './screens/Search/search';
import { TopBar } from './components/TopBar/topBar';
import { TabBar } from './components/TabBar/tabBar';
import Settings from './screens/Settings/settings';
import Thread from './screens/Thread/thread';
import Setup from './screens/Setup/setup';
import { useEmojiCachePrimer } from './hooks/useCustomEmojis';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { I18nProvider, useI18n } from './services/i18n/i18nContext';
import { NavigationProvider, StackEntry, useNavigator } from './services/navigationContext';

// Keep the pug splash up until the fonts and the saved account are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationRoot() {
  const { user, loading, logout, isAddingAccount, setAddingAccount, needsSetup, finishSetup } = useAuth();
  const { openCompose } = useCompose();
  const { colors, isDark, fontsReady } = useTheme();
  const { languageReady } = useI18n();
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'notifications' | 'profile'>('home');
  const { stack, push, pop, reset } = useNavigator();
  // The server's stored custom emoji, ready before anyone opens the picker
  useEmojiCachePrimer(user?.id);

  const handleTabPress = (tab: 'home' | 'search' | 'notifications' | 'profile') => {
      // The dock floats over the stacked screens: a tab press closes them all and shows that tab
      if (stack.length > 0) {
          reset();
          setActiveTab(tab);
      } else if (tab === 'home' && activeTab === 'home') {
          DeviceEventEmitter.emit('scroll_to_top_home');
      } else {
          setActiveTab(tab);
      }
  };

  const openThread = (id: string) => push({ name: 'thread', statusId: id });
  const openSettings = () => push({ name: 'settings' });

  // A screen stack belongs to one account
  useEffect(() => {
    reset();
  }, [user?.id, reset]);

  // Android's back button closes the top screen; with none open it leaves the app as usual
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length === 0) return false;
      pop();
      return true;
    });
    return () => subscription.remove();
  }, [stack.length, pop]);

  const renderScreen = ({ route }: StackEntry) => {
    switch (route.name) {
      case 'thread':
        // The header's ← goes back to the tabs; Android's back button steps through the posts one by one
        return <Thread statusId={route.statusId} onBack={reset} onStatusPress={openThread} />;
      case 'settings':
        return <Settings onBack={pop} />;
    }
  };

  const statusBarStyle = isDark ? 'light' : 'dark';
  const ready = !loading && fontsReady && languageReady;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Hidden behind the splash; only shows if the splash is dismissed early
  if (!ready) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.accentColor} />
      </View>
    )
  }

  if (!user || isAddingAccount) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Login onCancel={isAddingAccount && user ? () => setAddingAccount(false) : undefined} />
      </View>
    );
  };

  if (needsSetup) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Setup onDone={finishSetup} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* The tabs, always mounted. Hidden from screen readers while a screen is open over them */}
      <View
        style={styles.container}
        importantForAccessibility={stack.length > 0 ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={stack.length > 0}
      >
        {/* Top Bar */}
        <TopBar
          user={user}
          onProfilePress={() => setActiveTab('profile')}
          onSettingsPress={openSettings}
          onLogoutPress={logout}
        />

        {/* Screen content area */}
        <View style={styles.container}>
          {activeTab === 'home' && <Timeline onStatusPress={openThread} />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'notifications' && <Notifications onStatusPress={openThread} />}
          {activeTab === 'profile' && <Profile onStatusPress={openThread} onSettingsPress={openSettings} />}
        </View>
      </View>

      {/* Stacked screens over the tabs. Only the top one shows; the ones below stay mounted, so going
          back keeps their scroll position */}
      {stack.map((entry, index) => (
          <View
              key={entry.key}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, index < stack.length - 1 && styles.hidden]}
              importantForAccessibility={index < stack.length - 1 ? 'no-hide-descendants' : 'auto'}
              accessibilityElementsHidden={index < stack.length - 1}
          >
              {renderScreen(entry)}
          </View>
      ))}

      {/* Custom Tab Bar, last so it stays on top of the overlays on both platforms */}
      <TabBar activeTab={activeTab} onTabPress={handleTabPress} onComposePress={openCompose} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Above AuthProvider so it can reset cached server state when the account changes */}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
          <SettingsProvider>
            <AuthProvider>
              <ComposeProvider>
                <MediaViewerProvider>
                  <NavigationProvider>
                    <NavigationRoot />
                  </NavigationProvider>
                </MediaViewerProvider>
              </ComposeProvider>
            </AuthProvider>
          </SettingsProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
});

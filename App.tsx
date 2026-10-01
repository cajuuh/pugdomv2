import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, ActivityIndicator, DeviceEventEmitter, TouchableOpacity, Platform, LogBox, View } from 'react-native';

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
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';

// Keep the pug splash up until the fonts and the saved account are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationRoot() {
  const { user, loading, logout, isAddingAccount, setAddingAccount } = useAuth();
  const { openCompose } = useCompose();
  const { colors, isDark, fontsReady } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'notifications' | 'profile'>('home');
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings' | 'thread'>('main');
  const [threadStatusId, setThreadStatusId] = useState<string | null>(null);

  const handleTabPress = (tab: 'home' | 'search' | 'notifications' | 'profile') => {
      if (tab === 'home' && activeTab === 'home') {
          DeviceEventEmitter.emit('scroll_to_top_home');
      } else {
          setActiveTab(tab);
      }
  };

  const openThread = (id: string) => {
    setThreadStatusId(id);
    setCurrentScreen('thread');
  };

  const closeThread = () => {
    setCurrentScreen('main');
    setThreadStatusId(null);
  };

  const statusBarStyle = isDark ? 'light' : 'dark';
  const ready = !loading && fontsReady;

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Render main navigation stack always */}
      <View style={styles.container}>
        {/* Top Bar */}
        <TopBar
          user={user}
          onProfilePress={() => setActiveTab('profile')}
          onSettingsPress={() => setCurrentScreen('settings')}
          onLogoutPress={logout}
        />

        {/* Screen content area */}
        <View style={styles.container}>
          {activeTab === 'home' && <Timeline onStatusPress={openThread} />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'notifications' && <Notifications onStatusPress={openThread} />}
          {activeTab === 'profile' && <Profile onStatusPress={openThread} onSettingsPress={() => setCurrentScreen('settings')} />}
        </View>

        {/* Custom Tab Bar */}
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onComposePress={openCompose} />
      </View>

      {/* Render Thread as absolute overlay on top if active */}
      {currentScreen === 'thread' && threadStatusId && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
              <Thread statusId={threadStatusId} onBack={closeThread} onStatusPress={openThread} />
          </View>
      )}

      {/* Render Settings as absolute overlay on top if active */}
      {currentScreen === 'settings' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
              <Settings onBack={() => setCurrentScreen('main')} />
          </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Above AuthProvider so it can reset cached server state when the account changes */}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <ComposeProvider>
                <MediaViewerProvider>
                  <NavigationRoot />
                </MediaViewerProvider>
              </ComposeProvider>
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
});

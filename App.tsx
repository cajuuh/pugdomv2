import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, DeviceEventEmitter, TouchableOpacity, Platform, LogBox } from 'react-native';

LogBox.ignoreLogs([
    "SafeAreaView has been deprecated and will be removed in a future release",
]);
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native-ui-lib';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import { ComposeProvider, useCompose } from './services/composeContext';
import Login from './screens/Login/login';
import Profile from './screens/Profile/profile';
import Timeline from './screens/Timeline/timeline';
import Notifications from './screens/Notifications/notifications';
import Search from './screens/Search/search';
import { TopBar } from './components/TopBar/topBar';
import { TabBar } from './components/TabBar/tabBar';
import Settings from './screens/Settings/settings';
import Thread from './screens/Thread/thread';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function NavigationRoot() {
  const { user, loading, logout, isAddingAccount, setAddingAccount } = useAuth();
  const { openCompose } = useCompose();
  const { colors, isDark } = useTheme();
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

  if (loading) {
    return (
      <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.accentColor} />
      </View>
    )
  }

  if (!user || isAddingAccount) {
    return (
      <View flex style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Login onCancel={isAddingAccount && user ? () => setAddingAccount(false) : undefined} />
      </View>
    );
  };

  return (
    <View flex style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Render main navigation stack always */}
      <View flex>
        {/* Top Bar */}
        <TopBar
          user={user}
          onAvatarPress={() => setActiveTab('profile')}
          onSettingsPress={() => setCurrentScreen('settings')}
          onLogoutPress={logout}
        />

        {/* Screen content area */}
        <View flex>
          {activeTab === 'home' && <Timeline onStatusPress={openThread} />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'notifications' && <Notifications onStatusPress={openThread} />}
          {activeTab === 'profile' && <Profile />}
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
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <ComposeProvider>
              <QueryClientProvider client={queryClient}>
                <NavigationRoot />
              </QueryClientProvider>
            </ComposeProvider>
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
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

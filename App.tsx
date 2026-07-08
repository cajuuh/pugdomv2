import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { View } from 'react-native-ui-lib';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import { ComposeProvider } from './services/composeContext';
import Login from './screens/Login/login';
import Profile from './screens/Profile/profile';
import Timeline from './screens/Timeline/timeline';
import Notifications from './screens/Notifications/notifications';
import { TopBar } from './components/TopBar/topBar';
import { TabBar } from './components/TabBar/tabBar';
import Settings from './screens/Settings/settings';
import Thread from './screens/Thread/thread';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function NavigationRoot() {
  const { user, loading, logout, isAddingAccount, setAddingAccount } = useAuth();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'notifications' | 'profile'>('home');
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings' | 'thread'>('main');
  const [threadStatusId, setThreadStatusId] = useState<string | null>(null);

  const handleTabPress = (tab: 'home' | 'notifications' | 'profile') => {
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

  if (currentScreen === 'settings') {
    return (
      <View flex style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Settings onBack={() => setCurrentScreen('main')} />
      </View>
    );
  }

  if (currentScreen === 'thread' && threadStatusId) {
    return (
      <View flex style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Thread statusId={threadStatusId} onBack={closeThread} onStatusPress={openThread} />
      </View>
    );
  }

  return (
    <View flex style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

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
        {activeTab === 'notifications' && <Notifications onStatusPress={openThread} />}
        {activeTab === 'profile' && <Profile />}
      </View>
      {/* Custom Tab Bar */}
      <TabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  )
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
    backgroundColor: '#0f172A'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172A',
    justifyContent: 'center',
    alignItems: 'center'
  },

});

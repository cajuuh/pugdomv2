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

      <TouchableOpacity
          onPress={() => openCompose()}
          style={[styles.fabButton, { backgroundColor: colors.accentColor }]}
          activeOpacity={0.8}
      >
          <Ionicons name="create" size={24} color="#FFF" />
      </TouchableOpacity>

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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fabButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

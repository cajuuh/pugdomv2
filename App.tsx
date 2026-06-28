import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { View } from 'react-native-ui-lib';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import { ComposeProvider } from './services/composeContext';
import Login from './screens/Login/login';
import Profile from './screens/Profile/profile';
import Timeline from './screens/Timeline/timeline';
import { TopBar } from './components/TopBar/topBar';
import { TabBar } from './components/TabBar/tabBar';
import Settings from './screens/Settings/settings';

function NavigationRoot() {
  const { user, loading, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings'>('main');

  const statusBarStyle = isDark ? 'light' : 'dark';

  if (loading) {
    return (
      <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.accentColor} />
      </View>
    )
  }

  if (!user) {
    return (
      <View flex style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Login />
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
        {activeTab === 'home' ? <Timeline /> : <Profile />}
      </View>
      {/* Custom Tab Bar */}
      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
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
              <NavigationRoot />
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

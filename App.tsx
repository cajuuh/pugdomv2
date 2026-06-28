import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator } from 'react-native'
import { View, Text, TouchableOpacity } from 'react-native-ui-lib'
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import { ThemeProvider, useTheme } from './services/themeContext';
import Login from './screens/Login/login'
import Profile from './screens/Profile/profile'
import Timeline from './screens/Timeline/timeline';
import { TopBar } from './components/TopBar/topBar';
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
      <View style={[styles.tabBar, { backgroundColor: colors.tabBarBackground, borderTopColor: colors.borderColor }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('home')}
          style={styles.tabItem}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? colors.tabBarActiveColor : colors.tabBarInactiveColor}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? colors.tabBarActiveColor : colors.tabBarInactiveColor }]}>
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={styles.tabItem}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? colors.tabBarActiveColor : colors.tabBarInactiveColor}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? colors.tabBarActiveColor : colors.tabBarInactiveColor }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <NavigationRoot />
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
  tabBar: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  }
});

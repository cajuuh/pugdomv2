import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator } from 'react-native'
import { View, Text, TouchableOpacity } from 'react-native-ui-lib'
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './services/authContext';
import { SettingsProvider } from './services/settingsContext';
import Login from './screens/Login/login'
import Profile from './screens/Profile/profile'
import Timeline from './screens/Timeline/timeline';
import { TopBar } from './components/TopBar/topBar';
import Settings from './screens/Settings/settings';

function NavigationRoot() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings'>('main');

  if (loading) {
    return (
      <View flex center style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#6366F1' />
      </View>
    )
  }

  if (!user) {
    return (
      <View flex style={styles.container}>
        <StatusBar style='light' />
        <Login />
      </View>
    );
  };

  if (currentScreen === 'settings') {
    return (
      <View flex style={styles.container}>
        <StatusBar style='light' />
        <Settings onBack={() => setCurrentScreen('main')} />
      </View>
    );
  }

  return (
    <View flex style={styles.container}>
      <StatusBar style='light' />

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
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('home')}
          style={styles.tabItem}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? '#6366F1' : '#94A3B8' }]}>
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
            color={activeTab === 'profile' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? '#6366F1' : '#94A3B8' }]}>
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
      <SettingsProvider>
        <AuthProvider>
          <NavigationRoot />
        </AuthProvider>
      </SettingsProvider>
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

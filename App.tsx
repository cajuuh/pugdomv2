import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator } from 'react-native'
import { View } from 'react-native-ui-lib'
import { AuthProvider, useAuth } from './services/authContext';
import Login from './screens/Login/login'
import Profile from './screens/Profile/profile'

function NavigationRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View flex center style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#6366F1' />
      </View>
    )
  }

  return (
    <View flex style={styles.container}>
      <StatusBar style='light' />
      {user ? <Profile /> : <Login />}
    </View>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationRoot />
    </AuthProvider>
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
  }
});

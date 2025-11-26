import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../components/AuthProvider';
import authService from '../../services/authService';

export default function CallbackScreen() {
  const { refreshAuth } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCallback = async () => {
    try {
      // Extract token from URL query parameters
      const token = params.token as string;
      
      if (!token) {
        console.error('No token found in callback URL');
        router.replace('/auth/login');
        return;
      }

      // Store the token
      await authService.setToken(token);

      // Fetch user data with the token
      const user = await authService.fetchCurrentUser(token);
      
      if (!user) {
        console.error('Failed to fetch user data');
        router.replace('/auth/login');
        return;
      }

      // Store user data
      await authService.setUser(user);

      // Refresh auth state in context
      await refreshAuth();

      // Small delay to ensure state is updated
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (error) {
      console.error('Callback error:', error);
      // Navigate back to login on error
      router.replace('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size='large' color='#0066cc' />
      <Text style={styles.text}>Completing login...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

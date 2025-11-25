import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../components/AuthProvider';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [loggingIn, setLoggingIn] = useState<'github' | 'google' | null>(null);

  const handleLogin = async (provider: 'github' | 'google') => {
    try {
      setLoggingIn(provider);
      const success = await login(provider);

      if (success) {
        // Navigate to main app
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Login Failed',
          `Failed to login with ${provider}. Please try again.`,
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An error occurred during login. Please try again.');
    } finally {
      setLoggingIn(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🤖</Text>
          <Text style={styles.title}>AI Chat Demo</Text>
          <Text style={styles.subtitle}>
            Sign in to start chatting with AI agents
          </Text>
        </View>

        {/* Login Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.githubButton,
              (isLoading || loggingIn) && styles.buttonDisabled,
            ]}
            onPress={() => handleLogin('github')}
            disabled={isLoading || loggingIn !== null}
          >
            {loggingIn === 'github' ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <>
                <Text style={styles.githubIcon}>
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
                    <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
                  </svg>
                </Text>
                <Text style={styles.buttonText}>Continue with GitHub</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.googleButton,
              (isLoading || loggingIn) && styles.buttonDisabled,
            ]}
            onPress={() => handleLogin('google')}
            disabled={isLoading || loggingIn !== null}
          >
            {loggingIn === 'google' ? (
              <ActivityIndicator color='#333' />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={[styles.buttonText, styles.googleButtonText]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            This is a demo application. Your data is stored temporarily for the
            demo session only.
          </Text>
          <Text style={styles.infoText}>
            Rate limits: 50 messages/hour, 500 API requests/hour
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  githubButton: {
    backgroundColor: '#24292e',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  googleButtonText: {
    color: '#333',
  },
  githubIcon: {
    fontSize: 20,
    color: '#fff',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  infoContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Enable web browser to close after auth on iOS
WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
const TOKEN_KEY = '@ai_chat_token';
const USER_KEY = '@ai_chat_user';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'github' | 'google';
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Auth Service for managing authentication state
 */
class AuthService {
  /**
   * Get stored JWT token
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Store JWT token
   */
  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  }

  /**
   * Remove JWT token
   */
  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  /**
   * Get stored user data
   */
  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Store user data
   */
  async setUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
    }
  }

  /**
   * Remove user data
   */
  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  }

  /**
   * Fetch current user from API
   */
  async fetchCurrentUser(token: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  /**
   * Initialize OAuth for GitHub
   */
  async loginWithGitHub(): Promise<{ token: string; user: User } | null> {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'aichat',
        path: 'auth/callback',
      });

      console.log('GitHub OAuth redirect URI:', redirectUri);

      const authUrl = `${API_URL}/api/auth/github?mobile=true&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
      );

      if (result.type === 'success' && result.url) {
        // Extract token from URL
        const url = new URL(result.url);
        const token = url.searchParams.get('token');

        if (!token) {
          throw new Error('No token received');
        }

        // Fetch user data
        const user = await this.fetchCurrentUser(token);

        if (!user) {
          throw new Error('Failed to fetch user data');
        }

        // Store auth data
        await this.setToken(token);
        await this.setUser(user);

        return { token, user };
      }

      return null;
    } catch (error) {
      console.error('GitHub login error:', error);
      return null;
    }
  }

  /**
   * Initialize OAuth for Google
   */
  async loginWithGoogle(): Promise<{ token: string; user: User } | null> {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'aichat',
        path: 'auth/callback',
      });

      console.log('Google OAuth redirect URI:', redirectUri);

      const authUrl = `${API_URL}/api/auth/google?mobile=true&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
      );

      if (result.type === 'success' && result.url) {
        // Extract token from URL
        const url = new URL(result.url);
        const token = url.searchParams.get('token');

        if (!token) {
          throw new Error('No token received');
        }

        // Fetch user data
        const user = await this.fetchCurrentUser(token);

        if (!user) {
          throw new Error('Failed to fetch user data');
        }

        // Store auth data
        await this.setToken(token);
        await this.setUser(user);

        return { token, user };
      }

      return null;
    } catch (error) {
      console.error('Google login error:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const token = await this.getToken();

      if (token) {
        // Call logout endpoint (optional, since we're using JWT)
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {
          // Ignore errors, we're logging out anyway
        });
      }

      // Clear local storage
      await this.removeToken();
      await this.removeUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    try {
      const token = await this.getToken();
      const user = await this.getUser();

      return {
        token,
        user,
        isAuthenticated: !!token && !!user,
        isLoading: false,
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    }
  }
}

export const authService = new AuthService();
export default authService;

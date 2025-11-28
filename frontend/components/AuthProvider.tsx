import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import authService, { AuthState } from '../services/authService';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider - manages authentication state
 * Note: Authentication is handled at the cluster level via oauth2-proxy.
 * This provider manages local state caching and logout functionality.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load auth state on mount
  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const state = await authService.getAuthState();
      setAuthState(state);
    } catch (error) {
      console.error('Error loading auth state:', error);
      setAuthState({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await authService.logout();
      setAuthState({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshAuth = async () => {
    await loadAuthState();
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

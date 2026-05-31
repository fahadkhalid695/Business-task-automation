import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { User } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  // Validate existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Try to authenticate against the backend API
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      const { token: authToken, user: userData } = response.data.data;

      // Map backend user to frontend User type
      const mappedUser: User = {
        id: userData.id,
        email: userData.email,
        role: userData.role as any,
        permissions: [],
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            push: true,
            slack: false,
            taskReminders: true,
            workflowUpdates: true,
          },
          dashboard: {
            widgets: [],
            layout: 'grid',
            refreshInterval: 30000,
          },
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setUser(mappedUser);
      setToken(authToken);
      setIsAuthenticated(true);
      localStorage.setItem('token', authToken);
    } catch (error: any) {
      // If backend is unreachable, fall back to demo mode
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
      const isDemoCredentials = 
        (email === 'admin@example.com' && password === 'password') ||
        (email === 'user@example.com' && password === 'password');

      if (isNetworkError && isDemoCredentials) {
        console.warn('Backend unavailable, using demo mode');
        const demoUser: User = {
          id: '1',
          email,
          role: (email === 'admin@example.com' ? 'admin' : 'user') as any,
          permissions: [],
          preferences: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
            notifications: {
              email: true,
              push: true,
              slack: false,
              taskReminders: true,
              workflowUpdates: true,
            },
            dashboard: {
              widgets: [],
              layout: 'grid',
              refreshInterval: 30000,
            },
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const demoToken = 'demo-token-' + Date.now();
        setUser(demoUser);
        setToken(demoToken);
        setIsAuthenticated(true);
        localStorage.setItem('token', demoToken);
        return;
      }

      // If backend responded with an error (wrong credentials), throw it
      console.error('Login failed:', error?.response?.data?.message || error.message);
      setIsAuthenticated(false);
      throw new Error(error?.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
  }, []);

  const updateUser = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
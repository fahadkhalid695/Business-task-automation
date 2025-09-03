import axios from 'axios';
import { User } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export interface LoginResponse {
  user: User;
  token: string;
}

class AuthService {
  private baseURL = `${API_BASE_URL}/auth`;

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await axios.post(`${this.baseURL}/login`, {
      email,
      password,
    });

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'Login failed');
  }

  async register(email: string, password: string, role: string = 'user'): Promise<LoginResponse> {
    const response = await axios.post(`${this.baseURL}/register`, {
      email,
      password,
      role,
    });

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'Registration failed');
  }

  async getCurrentUser(): Promise<User> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await axios.get(`${this.baseURL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'Failed to get user');
  }

  async logout(): Promise<void> {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await axios.post(`${this.baseURL}/logout`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        // Ignore logout errors
        console.warn('Logout request failed:', error);
      }
    }
  }

  async refreshToken(): Promise<LoginResponse> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await axios.post(`${this.baseURL}/refresh`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.success) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'Token refresh failed');
  }
}

export const authService = new AuthService();
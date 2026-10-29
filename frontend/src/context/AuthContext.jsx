import axios from 'axios';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiBaseUrl = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/$/, '').replace(/\/api$/, '')}/api`
  : '/api';
const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cn_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;

export const handleAuthResponseError = (error) => {
  const status = error.response?.status;
  const url = error.config?.url || '';

  // Auth endpoints (login, register, logout, and profile) handle their own errors and session state
  const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout') || url.includes('/auth/profile');

  if (status === 401 && !isAuthEndpoint) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('cn_token');
    }

    const currentPath = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const isAuthPage = currentPath === '/login' || currentPath === '/register';

    if (!isAuthPage && !isRedirecting) {
      isRedirecting = true;
      setTimeout(() => {
        isRedirecting = false;
      }, 2000);
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/login';
      }
    }
  }

  return Promise.reject(error);
};

api.interceptors.response.use(
  (response) => response,
  handleAuthResponseError
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('cn_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/profile');
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('cn_token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success) {
      localStorage.setItem('cn_token', data.token);
      setUser(data.user);
      return data;
    }
    throw new Error(data.message || 'Login failed.');
  };

  const register = async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    if (data.success) {
      localStorage.setItem('cn_token', data.token);
      setUser(data.user);
      return data;
    }
    throw new Error(data.message || 'Registration failed.');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Server logout notice:', err.response?.data?.message || err.message);
    } finally {
      localStorage.removeItem('cn_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export default api;

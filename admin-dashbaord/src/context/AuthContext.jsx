import { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const userData = await authService.getCurrentUser();
        setCurrentUser(userData);
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError('Failed to authenticate user');
        // Clear invalid tokens
        localStorage.removeItem('token');
        localStorage.removeItem('isAuthenticated');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      localStorage.setItem('token', response.token);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Fetch user data after login
      const userData = await authService.getCurrentUser();
      setCurrentUser(userData);
      return { success: true };
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };
  
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Always clear local storage even if API call fails
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      setCurrentUser(null);
    }
  };
  
  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
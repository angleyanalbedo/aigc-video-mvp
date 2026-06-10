import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated, verifyToken, removeToken } from '../services/auth';

interface AuthContextType {
  isLoggedIn: boolean;
  loading: boolean;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  loading: true,
  logout: () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    if (!isAuthenticated()) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    const valid = await verifyToken();
    setIsLoggedIn(valid);
    if (!valid) removeToken();
    setLoading(false);
  };

  const logout = () => {
    removeToken();
    setIsLoggedIn(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, loading, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import api from '@/api/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('bakery_user');
      const token = sessionStorage.getItem('token');
      const refreshToken = sessionStorage.getItem('refreshToken');

      // Con el refresh token basta: el access token (15 min) se renueva solo en la primera petición.
      if (savedUser && (token || refreshToken)) {
        try {
          const parsedUser = JSON.parse(savedUser) as User;
          setUser(parsedUser);
        } catch {
          localStorage.removeItem('bakery_user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password }, {
          headers: { requiresAuth: false }
        });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Credenciales inválidas');
      }

      const { user: backendUser, token, refreshToken } = response.data.data;

      const roles: UserRole[] = backendUser.roles.map((r: { name: string }) => r.name);

      const frontendUser: User = {
        id: backendUser.id,
        username: backendUser.username,
        name: backendUser.name,
        roles
      };

      setUser(frontendUser);
      localStorage.setItem('bakery_user', JSON.stringify(frontendUser));
      sessionStorage.setItem('token', token);
      if (refreshToken) {
        sessionStorage.setItem('refreshToken', refreshToken);
      }

      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Error en login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    // Revoca el refresh token en el servidor (best effort: si falla, igual se cierra la sesión local)
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (refreshToken) {
      api
        .post('/auth/logout', { refreshToken }, { headers: { requiresAuth: false } })
        .catch((error) => console.warn('No se pudo revocar el refresh token:', error));
    }

    setUser(null);
    localStorage.removeItem('bakery_user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return user.roles.includes('admin') || user.roles.includes(role);
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
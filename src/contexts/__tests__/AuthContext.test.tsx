import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/api/api';
import { AuthProvider, useAuth } from '../AuthContext';
import type { User } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('settles to isLoading: false and user: null when storage is empty', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
  });

  it('restores a user from storage when both bakery_user and token are present', async () => {
    const savedUser: User = { id: '1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] };
    localStorage.setItem('bakery_user', JSON.stringify(savedUser));
    sessionStorage.setItem('token', 'saved-token');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(savedUser);
  });

  it('restores a user with only a refresh token: the access token renews itself on the first request', async () => {
    const savedUser: User = { id: '1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] };
    localStorage.setItem('bakery_user', JSON.stringify(savedUser));
    sessionStorage.setItem('refreshToken', 'refresh-1');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(savedUser);
  });

  it('clears storage and stays logged-out if bakery_user is invalid JSON', async () => {
    localStorage.setItem('bakery_user', '{not-valid-json');
    sessionStorage.setItem('token', 'saved-token');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('does not restore a user when only one of bakery_user/token is present', async () => {
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'gary', name: 'Gary', roles: ['admin'] }));
    // no token set

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
  });

  it('login() success path sets user, writes storage, and returns true', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: '1', username: 'gary', name: 'Gary Mamani', roles: [{ name: 'admin' }] },
          token: 't-123',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.login('gary', 'password');
    });

    expect(success).toBe(true);
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/auth/login',
      { username: 'gary', password: 'password' },
      { headers: { requiresAuth: false } }
    );
    expect(result.current.user).toEqual({ id: '1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] });
    expect(JSON.parse(localStorage.getItem('bakery_user') as string)).toEqual({
      id: '1',
      username: 'gary',
      name: 'Gary Mamani',
      roles: ['admin'],
    });
    expect(sessionStorage.getItem('token')).toBe('t-123');
    expect(result.current.isLoading).toBe(false);
  });

  it('login() also stores the refresh token', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: '1', username: 'gary', name: 'Gary Mamani', roles: [{ name: 'admin' }] },
          token: 't-123',
          refreshToken: 'r-456',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('gary', 'password');
    });

    expect(sessionStorage.getItem('token')).toBe('t-123');
    expect(sessionStorage.getItem('refreshToken')).toBe('r-456');
  });

  it('login() failure path (success: false) returns false and does not throw', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Credenciales inválidas' } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.login('gary', 'wrong-password');
    });

    expect(success).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('login() failure path (rejected request) returns false and does not throw', async () => {
    mockedApi.post.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.login('gary', 'password');
    });

    expect(success).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logout() clears user and storage', async () => {
    const savedUser: User = { id: '1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] };
    localStorage.setItem('bakery_user', JSON.stringify(savedUser));
    sessionStorage.setItem('token', 'saved-token');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(savedUser);

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('logout() revokes the refresh token on the server (without an access token) and clears it locally', async () => {
    const savedUser: User = { id: '1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] };
    localStorage.setItem('bakery_user', JSON.stringify(savedUser));
    sessionStorage.setItem('token', 'saved-token');
    sessionStorage.setItem('refreshToken', 'refresh-1');
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/auth/logout',
      { refreshToken: 'refresh-1' },
      { headers: { requiresAuth: false } }
    );
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
  });

  it('logout() still closes the local session when revoking on the server fails', async () => {
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'gary', name: 'G', roles: ['admin'] }));
    sessionStorage.setItem('refreshToken', 'refresh-1');
    mockedApi.post.mockRejectedValue(new Error('Network Error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
  });

  it('logout() does not call the server when there is no refresh token', async () => {
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'gary', name: 'G', roles: ['admin'] }));
    sessionStorage.setItem('token', 'saved-token');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  describe('hasRole / hasAnyRole', () => {
    it('hasRole returns false for any role when there is no user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasRole('seller')).toBe(false);
    });

    it('hasRole matches the exact role for a non-admin user', async () => {
      localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'b', name: 'Baker', roles: ['baker'] }));
      sessionStorage.setItem('token', 't');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole('baker')).toBe(true);
      expect(result.current.hasRole('seller')).toBe(false);
    });

    it('admin bypasses hasRole for any role', async () => {
      localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'a', name: 'Admin', roles: ['admin'] }));
      sessionStorage.setItem('token', 't');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole('seller')).toBe(true);
      expect(result.current.hasRole('baker')).toBe(true);
      expect(result.current.hasRole('delivery')).toBe(true);
    });

    it('hasAnyRole returns true if the user has at least one of the given roles', async () => {
      localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'b', name: 'Baker', roles: ['baker'] }));
      sessionStorage.setItem('token', 't');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasAnyRole(['seller', 'baker'])).toBe(true);
      expect(result.current.hasAnyRole(['seller', 'designer'])).toBe(false);
    });

    it('admin bypasses hasAnyRole for any list of roles', async () => {
      localStorage.setItem('bakery_user', JSON.stringify({ id: '1', username: 'a', name: 'Admin', roles: ['admin'] }));
      sessionStorage.setItem('token', 't');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasAnyRole(['designer'])).toBe(true);
      expect(result.current.hasAnyRole([])).toBe(false);
    });
  });
});

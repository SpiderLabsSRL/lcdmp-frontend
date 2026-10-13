import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import api, { refreshAccessToken } from '../api';

// axios stores interceptors in interceptors.request/response.handlers[].{fulfilled, rejected}
const requestInterceptor = (api.interceptors.request as any).handlers[0];
const responseInterceptor = (api.interceptors.response as any).handlers[0];

describe('api (axios instance) - request interceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('adds the Authorization header from sessionStorage when a token exists and auth is required', () => {
    sessionStorage.setItem('token', 'abc123');
    const config: any = { headers: {} };

    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.Authorization).toBe('Bearer abc123');
  });

  it('does not add an Authorization header when there is no token', () => {
    const config: any = { headers: {} };

    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('does not add an Authorization header when requiresAuth is explicitly false', () => {
    sessionStorage.setItem('token', 'abc123');
    const config: any = { headers: { requiresAuth: false } };

    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('flags requests with requiresAuth:false (login/logout) so a 401 on them never triggers a refresh', () => {
    const config: any = { headers: { requiresAuth: false } };

    const result = requestInterceptor.fulfilled(config);

    expect(result.skipAuthRefresh).toBe(true);
  });

  it('does not flag normal authenticated requests', () => {
    const config: any = { headers: {} };

    expect(requestInterceptor.fulfilled(config).skipAuthRefresh).toBeUndefined();
  });

  it('always strips the requiresAuth flag off the outgoing headers', () => {
    sessionStorage.setItem('token', 'abc123');
    const config: any = { headers: { requiresAuth: true } };

    const result = requestInterceptor.fulfilled(config);

    expect(result.headers.requiresAuth).toBeUndefined();
  });
});

describe('api (axios instance) - response interceptor', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('passes successful responses through unchanged', () => {
    const response = { data: { success: true } };

    const result = responseInterceptor.fulfilled(response);

    expect(result).toBe(response);
  });

  it('on a 401 with a generic message, clears storage and redirects to /login', async () => {
    sessionStorage.setItem('token', 'abc123');
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1' }));
    const error = { response: { status: 401, data: { message: 'Token expirado' } } };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('on a 401 with the "Usuario no encontrado o inactivo" message, does not clear storage or redirect', async () => {
    sessionStorage.setItem('token', 'abc123');
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1' }));
    const error = { response: { status: 401, data: { message: 'Usuario no encontrado o inactivo' } } };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem('token')).toBe('abc123');
    expect(localStorage.getItem('bakery_user')).not.toBeNull();
    expect(window.location.href).toBe('');
  });

  it('on a non-401 error, does not clear storage or redirect', async () => {
    sessionStorage.setItem('token', 'abc123');
    const error = { response: { status: 500, data: { message: 'Server error' } } };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem('token')).toBe('abc123');
    expect(window.location.href).toBe('');
  });

  it('on an error with no response object, does not throw and just rejects', async () => {
    const error = { message: 'Network Error' };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);
    expect(window.location.href).toBe('');
  });
});

describe('api (axios instance) - automatic token refresh', () => {
  const originalLocation = window.location;
  const unauthorized = (config: any) => ({
    config,
    response: { status: 401, data: { message: 'Token expirado' } },
  });
  // Petición reintentada: el adaptador responde 200 y deja ver el header que llevaba
  const okAdapter = () =>
    vi.fn(async (config: any) => ({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config }));

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('on a 401 with a refresh token, renews the access token and retries the original request with it', async () => {
    sessionStorage.setItem('token', 'expired');
    sessionStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1' }));
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true, data: { token: 'fresh' } } });
    const adapter = okAdapter();

    const result: any = await responseInterceptor.rejected(
      unauthorized({ url: '/orders', method: 'get', headers: {}, adapter })
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
    expect(post.mock.calls[0][1]).toEqual({ refreshToken: 'refresh-1' });
    expect(sessionStorage.getItem('token')).toBe('fresh');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer fresh');
    expect(result.data).toEqual({ success: true });
    // la sesión sigue viva
    expect(localStorage.getItem('bakery_user')).not.toBeNull();
    expect(window.location.href).toBe('');
  });

  it('shares ONE refresh call between requests that fail at the same time', async () => {
    sessionStorage.setItem('refreshToken', 'refresh-1');
    let resolveRefresh: (v: unknown) => void = () => {};
    const post = vi.spyOn(axios, 'post').mockReturnValue(
      new Promise((resolve) => { resolveRefresh = resolve; }) as any
    );

    const first = responseInterceptor.rejected(unauthorized({ url: '/a', method: 'get', headers: {}, adapter: okAdapter() }));
    const second = responseInterceptor.rejected(unauthorized({ url: '/b', method: 'get', headers: {}, adapter: okAdapter() }));
    resolveRefresh({ data: { success: true, data: { token: 'fresh' } } });
    await Promise.all([first, second]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('when the server rejects the refresh token, ends the session and rejects with the original error', async () => {
    sessionStorage.setItem('token', 'expired');
    sessionStorage.setItem('refreshToken', 'revoked');
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1' }));
    vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401, data: { message: 'Refresh token inválido o expirado' } } });
    const error = unauthorized({ url: '/orders', method: 'get', headers: {} });

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('bakery_user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('on a network failure while refreshing, does NOT log the user out', async () => {
    sessionStorage.setItem('token', 'expired');
    sessionStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('bakery_user', JSON.stringify({ id: '1' }));
    const networkError = { message: 'Network Error' };
    vi.spyOn(axios, 'post').mockRejectedValue(networkError);

    await expect(
      responseInterceptor.rejected(unauthorized({ url: '/orders', method: 'get', headers: {} }))
    ).rejects.toBe(networkError);

    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-1');
    expect(localStorage.getItem('bakery_user')).not.toBeNull();
    expect(window.location.href).toBe('');
  });

  it('does not try to refresh twice for the same request (a second 401 ends the session)', async () => {
    sessionStorage.setItem('refreshToken', 'refresh-1');
    const post = vi.spyOn(axios, 'post');
    const error = unauthorized({ url: '/orders', method: 'get', headers: {}, _retry: true });

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('never refreshes for login/logout requests (skipAuthRefresh)', async () => {
    sessionStorage.setItem('refreshToken', 'refresh-1');
    const post = vi.spyOn(axios, 'post');
    const error = {
      config: { url: '/auth/login', headers: {}, skipAuthRefresh: true },
      response: { status: 401, data: { message: 'Usuario no encontrado o inactivo' } },
    };

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(post).not.toHaveBeenCalled();
  });

  it('without a refresh token it keeps the old behaviour (clear storage and go to /login)', async () => {
    sessionStorage.setItem('token', 'expired');
    const post = vi.spyOn(axios, 'post');
    const error = unauthorized({ url: '/orders', method: 'get', headers: {} });

    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);

    expect(post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('refreshAccessToken rejects right away when there is no refresh token', async () => {
    const post = vi.spyOn(axios, 'post');

    await expect(refreshAccessToken()).rejects.toThrow('No hay refresh token');
    expect(post).not.toHaveBeenCalled();
  });

  it('refreshAccessToken stores and returns the new access token', async () => {
    sessionStorage.setItem('refreshToken', 'refresh-1');
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true, data: { token: 'fresh' } } });

    await expect(refreshAccessToken()).resolves.toBe('fresh');
    expect(sessionStorage.getItem('token')).toBe('fresh');
  });
});

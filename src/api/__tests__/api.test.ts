import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';

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

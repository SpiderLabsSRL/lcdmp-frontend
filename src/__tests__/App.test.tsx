import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import App from '../App';

function setLoggedInUser(roles: string[]) {
  localStorage.setItem(
    'bakery_user',
    JSON.stringify({ id: '1', username: 'u', name: 'Test User', roles })
  );
  sessionStorage.setItem('token', 't');
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects an unauthenticated visitor to /login', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(await screen.findByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('renders the dashboard for a logged-in admin at /dashboard', async () => {
    setLoggedInUser(['admin']);
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(await screen.findByText('Test User')).toBeInTheDocument();
  });

  it('renders the 404 page for an unknown route', async () => {
    window.history.pushState({}, '', '/this-route-does-not-exist');
    render(<App />);

    expect(await screen.findByText(/404/)).toBeInTheDocument();
  });

  it('redirects a logged-in user without the required role away from an admin-only route', async () => {
    setLoggedInUser(['baker']);
    window.history.pushState({}, '', '/users');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });
});

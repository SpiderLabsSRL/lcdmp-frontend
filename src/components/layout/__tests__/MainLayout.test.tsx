import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { AuthProvider } from '@/contexts/AuthContext';
import { MainLayout } from '../MainLayout';

describe('MainLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders its children alongside the sidebar for a logged-in user', async () => {
    localStorage.setItem(
      'bakery_user',
      JSON.stringify({ id: '1', username: 'u', name: 'Test User', roles: ['admin'] })
    );
    sessionStorage.setItem('token', 't');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <MainLayout>
            <div>Page content</div>
          </MainLayout>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());

    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByText('La Casa de Mi Padre')).toBeInTheDocument();
  });

  it('renders children and the sidebar shell even when there is no logged-in user', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <MainLayout>
            <div>Public content</div>
          </MainLayout>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Public content')).toBeInTheDocument());
    // Only the roleless nav item is visible without a logged-in user
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });
});

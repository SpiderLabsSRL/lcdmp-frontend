import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '../ProtectedRoute';

const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function renderProtected(roles?: string[]) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute roles={roles as any}>
              <div>Secret</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('shows a loading state while auth is resolving', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true, hasAnyRole: vi.fn() });

    renderProtected();

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, hasAnyRole: vi.fn() });

    renderProtected();

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('redirects to /dashboard when the user lacks one of the required roles', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', username: 'u', name: 'U', roles: ['baker'] },
      isLoading: false,
      hasAnyRole: vi.fn().mockReturnValue(false),
    });

    renderProtected(['admin']);

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('renders children when the user has one of the required roles', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', username: 'u', name: 'U', roles: ['admin'] },
      isLoading: false,
      hasAnyRole: vi.fn().mockReturnValue(true),
    });

    renderProtected(['admin']);

    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('renders children when no roles are required, regardless of hasAnyRole', () => {
    const hasAnyRole = vi.fn().mockReturnValue(false);
    mockedUseAuth.mockReturnValue({
      user: { id: '1', username: 'u', name: 'U', roles: ['baker'] },
      isLoading: false,
      hasAnyRole,
    });

    renderProtected();

    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(hasAnyRole).not.toHaveBeenCalled();
  });
});

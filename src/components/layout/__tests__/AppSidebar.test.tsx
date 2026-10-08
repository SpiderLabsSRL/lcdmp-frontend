import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));

import { AuthProvider } from '@/contexts/AuthContext';
import { AppSidebar } from '../AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

function setLoggedInUser(roles: string[]) {
  localStorage.setItem(
    'bakery_user',
    JSON.stringify({ id: '1', username: 'u', name: 'Test User', roles })
  );
  sessionStorage.setItem('token', 't');
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <AppSidebar />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AppSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('shows every nav item for an admin user', async () => {
    setLoggedInUser(['admin']);
    renderSidebar();

    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Productos')).toBeInTheDocument();
    expect(screen.getByText('Inventario')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
  });

  it('shows only role-appropriate nav items for a baker-only user', async () => {
    setLoggedInUser(['baker']);
    renderSidebar();

    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());

    // Visible to everyone
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    // Baker-visible items
    expect(screen.getByText('Inventario')).toBeInTheDocument();
    // "Hornos" appears twice: the nav link, and the user's role badge in the
    // footer (roleNames maps the 'baker' role to the label "Hornos" too) —
    // target the nav link specifically to disambiguate.
    expect(screen.getByRole('link', { name: 'Hornos' })).toBeInTheDocument();
    // Admin/seller/designer/delivery-only items should be hidden
    expect(screen.queryByText('Ventas')).not.toBeInTheDocument();
    expect(screen.queryByText('Productos')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Configuración')).not.toBeInTheDocument();
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
    expect(screen.queryByText('Decoración')).not.toBeInTheDocument();
  });

  it('logs out and clears storage when "Cerrar Sesión" is clicked', async () => {
    setLoggedInUser(['admin']);
    renderSidebar();

    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());
    expect(localStorage.getItem('bakery_user')).not.toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByText('Cerrar Sesión'));

    await waitFor(() => expect(localStorage.getItem('bakery_user')).toBeNull());
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('shows the brand title on desktop', async () => {
    setLoggedInUser(['admin']);
    renderSidebar();

    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());
    expect(screen.getByText('La Casa de Mi Padre')).toBeInTheDocument();
    expect(screen.getByText('Repostería Artesanal')).toBeInTheDocument();
  });
});

describe('AppSidebar - mobile menu', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(useIsMobile).mockReturnValue(true);
  });

  it('hides the brand title to save vertical space, and lets the nav scroll independently so the last items and "Cerrar Sesión" stay reachable', async () => {
    setLoggedInUser(['admin']);
    renderSidebar();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await waitFor(() => expect(screen.getByText('Test User')).toBeInTheDocument());

    // "Elimina las letras" — no brand title/subtitle on mobile.
    expect(screen.queryByText('La Casa de Mi Padre')).not.toBeInTheDocument();
    expect(screen.queryByText('Repostería Artesanal')).not.toBeInTheDocument();

    // The sheet is a bounded flex column so only <nav> scrolls, keeping the
    // header/footer (and "Cerrar Sesión") always on screen regardless of
    // how many nav items are visible for the user's roles.
    const sheetContent = screen.getByRole('link', { name: 'Inicio' }).closest('[role="dialog"]') as HTMLElement;
    expect(sheetContent.className).toContain('flex');
    expect(sheetContent.className).toContain('flex-col');

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('flex-1');
    expect(nav.className).toContain('overflow-y-auto');
    expect(nav.className).toContain('min-h-0');

    expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
  });
});

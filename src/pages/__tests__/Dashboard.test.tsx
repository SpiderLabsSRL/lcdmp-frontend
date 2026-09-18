import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Dashboard from '../Dashboard';
import type { User } from '@/types';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const loginAs = (user: User) => {
  localStorage.setItem('bakery_user', JSON.stringify(user));
  sessionStorage.setItem('token', 'fake-token');
};

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigateMock.mockClear();
  });

  it('renders every stat card with the hardcoded summary numbers for an admin', async () => {
    loginAs({ id: 'u1', username: 'gary', name: 'Gary Mamani', roles: ['admin'] });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('¡Buen día, Gary!')).toBeInTheDocument();

    expect(screen.getByText(`Bs. ${(2450).toLocaleString()}`)).toBeInTheDocument(); // todaySales
    expect(screen.getByText('+12% vs. ayer')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument(); // pending orders
    expect(screen.getByText('5')).toBeInTheDocument(); // inProduction
    expect(screen.getByText('3')).toBeInTheDocument(); // readyForDelivery
    expect(screen.getByText('4')).toBeInTheDocument(); // lowStock
    expect(screen.getByText('12')).toBeInTheDocument(); // completedToday

    // Recent orders list
    expect(screen.getByText('Torta de Chocolate')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
    expect(screen.getByText('Decorando')).toBeInTheDocument();
  });

  it('hides role-gated cards for a user with only the seller role', async () => {
    loginAs({ id: 'u2', username: 'vendedora', name: 'Lucia Fernandez', roles: ['seller'] });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('¡Buen día, Lucia!')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Ventas de Hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Listos para Envío' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stock Bajo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ver Hornos' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nueva Venta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menús Especiales' })).toBeInTheDocument();
  });

  it('navigates to /sales when the "Nueva Venta" quick action is clicked', async () => {
    loginAs({ id: 'u2', username: 'vendedora', name: 'Lucia Fernandez', roles: ['seller'] });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await screen.findByRole('heading', { name: 'Nueva Venta' });
    await user.click(screen.getByRole('heading', { name: 'Nueva Venta' }));

    expect(navigateMock).toHaveBeenCalledWith('/sales');
  });
});

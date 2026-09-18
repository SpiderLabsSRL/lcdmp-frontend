import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { toast } from 'sonner';
import Settings from '../Settings';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the general tab by default with business info fields', () => {
    renderWithProviders(<Settings />);

    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Información del Negocio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('La Casa de Mi Padre')).toBeInTheDocument();
  });

  it('switches to the Sucursales tab and lists mock branches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole('tab', { name: 'Sucursales' }));

    expect(screen.getByText('Sucursal Central')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('disables the delete button for the main branch only', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole('tab', { name: 'Sucursales' }));

    const centralRow = screen.getByText('Sucursal Central').closest('div.flex.items-center.justify-between');
    const norteRow = screen.getByText('Sucursal Norte').closest('div.flex.items-center.justify-between');

    const centralDeleteBtn = centralRow?.querySelectorAll('button')[1];
    const norteDeleteBtn = norteRow?.querySelectorAll('button')[1];

    expect(centralDeleteBtn).toBeDisabled();
    expect(norteDeleteBtn).not.toBeDisabled();
  });

  it('switches to the Pagos tab and shows payment methods', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole('tab', { name: 'Pagos' }));

    expect(screen.getByText('Métodos de Pago')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Pago QR')).toBeInTheDocument();
  });

  it('switches to the Notificaciones tab and shows notification settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole('tab', { name: 'Notificaciones' }));

    expect(screen.getByText('Nuevos pedidos')).toBeInTheDocument();
    expect(screen.getByText('Horarios de Notificación')).toBeInTheDocument();
  });

  it('calls toast.success when clicking Guardar Cambios', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    const saveButtons = screen.getAllByRole('button', { name: 'Guardar Cambios' });
    await user.click(saveButtons[0]);

    expect(toast.success).toHaveBeenCalledWith('Configuración guardada');
  });
});

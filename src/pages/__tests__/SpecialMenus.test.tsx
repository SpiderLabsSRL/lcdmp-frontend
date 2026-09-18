import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
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
import SpecialMenus from '../SpecialMenus';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

describe('SpecialMenus', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the active menus section and the full list', () => {
    renderWithProviders(<SpecialMenus />);

    expect(screen.getByText('Menús Especiales')).toBeInTheDocument();
    expect(screen.getByText('Menús Activos')).toBeInTheDocument();
    expect(screen.getByText('Todos los Menús')).toBeInTheDocument();

    // Día de la Madre 2024 is active -> shown in both the active grid and the full list.
    expect(screen.getAllByText('Día de la Madre 2024').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('San Valentín 2024')).toBeInTheDocument();
  });

  it('filters the list by status using the select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SpecialMenus />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await user.selectOptions(select, 'past');

    expect(screen.getByText('Menús Pasados')).toBeInTheDocument();
    expect(screen.getByText('San Valentín 2024')).toBeInTheDocument();
    // Active menu section should disappear since filter is 'past'.
    expect(screen.queryByText('Menús Activos')).not.toBeInTheDocument();
  });

  it('shows a reset filters button and clears the filter when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SpecialMenus />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await user.selectOptions(select, 'active');

    const resetBtn = screen.getByRole('button', { name: /Limpiar filtros/i });
    await user.click(resetBtn);

    expect(toast.info).toHaveBeenCalledWith('Filtros restablecidos');
    expect(screen.getByText('Todos los Menús')).toBeInTheDocument();
  });

  it('opens the menu detail dialog when clicking the eye icon', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SpecialMenus />);

    const listSection = screen.getByText('Todos los Menús').closest('div')!.parentElement!;
    const row = within(listSection).getByText('San Valentín 2024').closest('div.flex.flex-col')!;
    const eyeButton = within(row as HTMLElement).getAllByRole('button')[0];

    await user.click(eyeButton);

    expect(screen.getByText('Fecha del evento')).toBeInTheDocument();
    expect(screen.getByText('No hay productos asignados')).toBeInTheDocument();
  });

  it('opens the create menu dialog and submits successfully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SpecialMenus />);

    await user.click(screen.getByRole('button', { name: /Nuevo Menú/i }));

    expect(screen.getByText('Nuevo Menú Especial')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ej: Día de la Madre 2024'), 'Navidad 2026');
    await user.type(screen.getByText('Fecha del evento *').parentElement!.querySelector('input')!, '2026-12-25');
    await user.click(screen.getByRole('button', { name: 'Crear Menú' }));

    expect(toast.success).toHaveBeenCalledWith('Menú especial creado');
  });
});

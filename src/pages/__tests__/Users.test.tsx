import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import type { IUsersApi } from '@/api/UsersApi';
import type { User } from '@/types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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
import Users from '../Users';

// Radix's Checkbox measures itself via ResizeObserver, which jsdom does not provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;

const baseUsers: User[] = [
  { id: '1', name: 'Gary Mamani', username: 'gary.mamani', roles: ['admin'], isActive: true },
  { id: '2', name: 'Ana Flores', username: 'ana.flores', roles: ['seller'], isActive: false },
];

function buildMockApi(users: User[] = baseUsers): IUsersApi {
  return {
    getUsers: vi.fn().mockResolvedValue(users),
    createUser: vi.fn().mockResolvedValue(undefined),
    editUser: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    toggleUserStatus: vi.fn().mockResolvedValue(undefined),
  };
}

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

describe('Users', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a loading state then the populated user table', async () => {
    const api = buildMockApi();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(api.getUsers).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Gary Mamani')).toBeInTheDocument());

    expect(screen.getByText('Ana Flores')).toBeInTheDocument();
    expect(screen.getByText('gary.mamani')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Vendedor')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('shows the empty state when there are no users', async () => {
    const api = buildMockApi([]);
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('No se encontraron usuarios')).toBeInTheDocument());
  });

  it('shows an error toast when loading users fails', async () => {
    const api = buildMockApi();
    (api.getUsers as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));

    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar usuarios'));
  });

  it('reloads users with the new search term when typing in search', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Gary Mamani')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Buscar usuarios...'), 'ana');

    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith('ana'));
  });

  it('creates a new user via the dialog form', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Gary Mamani')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Nuevo Usuario/i }));
    expect(screen.getByRole('heading', { name: 'Nuevo Usuario' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Nombre del usuario'), 'Nuevo Usuario Test');
    await user.type(screen.getByPlaceholderText('gary.mamani'), 'nuevo.usuario');
    await user.type(screen.getByPlaceholderText('Contraseña segura'), 'secret123');
    await user.click(screen.getByRole('checkbox', { name: 'Vendedor' }));

    await user.click(screen.getByRole('button', { name: 'Crear Usuario' }));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        name: 'Nuevo Usuario Test',
        username: 'nuevo.usuario',
        password: 'secret123',
        roles: ['seller'],
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Usuario creado exitosamente');
  });

  it('disables the create submit button until a role is selected', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Gary Mamani')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Nuevo Usuario/i }));

    expect(screen.getByRole('button', { name: 'Crear Usuario' })).toBeDisabled();
  });

  it('edits an existing user via the row edit button', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Ana Flores')).toBeInTheDocument());

    const row = screen.getByText('Ana Flores').closest('tr')!;
    const editBtn = within(row).getAllByRole('button')[1];
    await user.click(editBtn);

    expect(screen.getByText('Editar Usuario')).toBeInTheDocument();
    const usernameInput = screen.getByPlaceholderText('gary.mamani') as HTMLInputElement;
    expect(usernameInput.value).toBe('ana.flores');

    await user.click(screen.getByRole('button', { name: 'Actualizar Usuario' }));

    await waitFor(() =>
      expect(api.editUser).toHaveBeenCalledWith('2', {
        name: 'Ana Flores',
        username: 'ana.flores',
        roles: ['seller'],
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Usuario actualizado exitosamente');
  });

  it('deletes a user via the delete confirmation dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Ana Flores')).toBeInTheDocument());

    const row = screen.getByText('Ana Flores').closest('tr')!;
    const deleteBtn = within(row).getAllByRole('button')[2];
    await user.click(deleteBtn);

    expect(screen.getByRole('heading', { name: 'Eliminar Usuario' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Eliminar Usuario/i }));

    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith('2'));
    expect(toast.success).toHaveBeenCalledWith('Usuario eliminado exitosamente');
  });

  it('disables delete for admin users', async () => {
    const api = buildMockApi();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Gary Mamani')).toBeInTheDocument());

    const row = screen.getByText('Gary Mamani').closest('tr')!;
    const deleteBtn = within(row).getAllByRole('button')[2];
    expect(deleteBtn).toBeDisabled();
  });

  it('toggles a user status via the toggle confirmation dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Users api={api} />);

    await waitFor(() => expect(screen.getByText('Ana Flores')).toBeInTheDocument());

    const row = screen.getByText('Ana Flores').closest('tr')!;
    const toggleBtn = within(row).getAllByRole('button')[0];
    await user.click(toggleBtn);

    expect(screen.getByRole('heading', { name: 'Activar Usuario' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Activar Usuario/i }));

    await waitFor(() => expect(api.toggleUserStatus).toHaveBeenCalledWith('2'));
    expect(toast.success).toHaveBeenCalledWith('Usuario activado exitosamente');
  });
});

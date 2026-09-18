import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/api/api';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import Login from '../Login';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
        <Toaster />
      </AuthProvider>
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    renderLogin();

    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('allows typing username and password', async () => {
    const user = userEvent.setup();
    renderLogin();

    const usernameInput = screen.getByLabelText('Nombre de usuario') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Contraseña') as HTMLInputElement;

    await user.type(usernameInput, 'gary');
    await user.type(passwordInput, 'secret123');

    expect(usernameInput.value).toBe('gary');
    expect(passwordInput.value).toBe('secret123');
  });

  it('navigates to /dashboard on successful login', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: '1', username: 'gary', name: 'Gary Mamani', roles: [{ name: 'admin' }] },
          token: 't-123',
        },
      },
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Nombre de usuario'), 'gary');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows an error and stays on the page when login fails', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Credenciales inválidas' } });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Nombre de usuario'), 'gary');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByText('Error de acceso')).toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
  });
});

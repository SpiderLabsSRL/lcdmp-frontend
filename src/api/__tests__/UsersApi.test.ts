import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { UsersApi, MockUsersApi } from '../UsersApi';
import type { CreateUser } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('UsersApi (real, axios-backed)', () => {
  let usersApi: UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    usersApi = new UsersApi();
  });

  describe('getUsers', () => {
    it('gets /users with an undefined search param when no term is given', async () => {
      const users = [{ id: '1', name: 'Carlos' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: users } });

      const result = await usersApi.getUsers();

      expect(mockedApi.get).toHaveBeenCalledWith('/users', { params: { search: undefined } });
      expect(result).toEqual(users);
    });

    it('gets /users with the given search term', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await usersApi.getUsers('carlos');

      expect(mockedApi.get).toHaveBeenCalledWith('/users', { params: { search: 'carlos' } });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener usuarios' } });

      await expect(usersApi.getUsers()).rejects.toThrow('Error al obtener usuarios');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(usersApi.getUsers()).rejects.toThrow('Network Error');
    });
  });

  describe('createUser', () => {
    const newUser: CreateUser = {
      username: 'nuevo@lacasademipa.com',
      password: 'secret123',
      name: 'Nuevo Usuario',
      roles: ['seller'],
    };

    it('posts the user data and resolves on success', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: true }, status: 201 });

      await expect(usersApi.createUser(newUser)).resolves.toBeUndefined();

      expect(mockedApi.post).toHaveBeenCalledWith('/users', newUser);
    });

    it('does not throw when success is false but status is 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false }, status: 201 });

      await expect(usersApi.createUser(newUser)).resolves.toBeUndefined();
    });

    it('throws with the backend message when success is false and status is not 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Error al crear usuario' }, status: 400 });

      await expect(usersApi.createUser(newUser)).rejects.toThrow('Error al crear usuario');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(usersApi.createUser(newUser)).rejects.toThrow('Network Error');
    });
  });

  describe('editUser', () => {
    it('puts to /users/:id with the partial data and resolves on success', async () => {
      mockedApi.put.mockResolvedValue({ data: { success: true } });

      await expect(usersApi.editUser('1', { name: 'Nombre editado' })).resolves.toBeUndefined();

      expect(mockedApi.put).toHaveBeenCalledWith('/users/1', { name: 'Nombre editado' });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.put.mockResolvedValue({ data: { success: false, message: 'Error al actualizar usuario' } });

      await expect(usersApi.editUser('1', {})).rejects.toThrow('Error al actualizar usuario');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.put.mockRejectedValue(new Error('Network Error'));

      await expect(usersApi.editUser('1', {})).rejects.toThrow('Network Error');
    });
  });

  describe('deleteUser', () => {
    it('deletes /users/:id and resolves on success', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: true } });

      await expect(usersApi.deleteUser('1')).resolves.toBeUndefined();

      expect(mockedApi.delete).toHaveBeenCalledWith('/users/1');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: false, message: 'Error al eliminar usuario' } });

      await expect(usersApi.deleteUser('1')).rejects.toThrow('Error al eliminar usuario');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.delete.mockRejectedValue(new Error('Network Error'));

      await expect(usersApi.deleteUser('1')).rejects.toThrow('Network Error');
    });
  });

  describe('toggleUserStatus', () => {
    it('patches /users/:id/toggle-status and resolves on success', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: true } });

      await expect(usersApi.toggleUserStatus('1')).resolves.toBeUndefined();

      expect(mockedApi.patch).toHaveBeenCalledWith('/users/1/toggle-status');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al cambiar estado del usuario' } });

      await expect(usersApi.toggleUserStatus('1')).rejects.toThrow('Error al cambiar estado del usuario');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(usersApi.toggleUserStatus('1')).rejects.toThrow('Network Error');
    });
  });
});

describe('MockUsersApi (in-memory)', () => {
  let mockApi: MockUsersApi;

  beforeEach(() => {
    mockApi = new MockUsersApi();
  });

  it('seeds with the mock users, all active', async () => {
    const users = await mockApi.getUsers();

    expect(users.length).toBeGreaterThan(0);
    expect(users.every(u => u.isActive === true)).toBe(true);
  });

  it('filters users by name or username (case-insensitive)', async () => {
    const byName = await mockApi.getUsers('carlos');
    expect(byName.every(u =>
      u.name.toLowerCase().includes('carlos') || u.username.toLowerCase().includes('carlos')
    )).toBe(true);
    expect(byName.length).toBeGreaterThan(0);
  });

  it('returns an empty array when the search term matches nothing', async () => {
    const users = await mockApi.getUsers('usuario-inexistente-xyz');
    expect(users).toEqual([]);
  });

  it('creates a user and appends it to the list, active by default', async () => {
    await mockApi.createUser({
      username: 'nuevo@lacasademipa.com',
      password: 'secret123',
      name: 'Nuevo Usuario',
      roles: ['seller'],
    });

    const all = await mockApi.getUsers('Nuevo Usuario');
    expect(all).toHaveLength(1);
    expect(all[0].isActive).toBe(true);
    expect(all[0].roles).toEqual(['seller']);
  });

  it('edits only the provided fields of an existing user', async () => {
    const before = await mockApi.getUsers();
    const targetId = before[0].id;
    const originalUsername = before[0].username;

    await mockApi.editUser(targetId, { name: 'Nombre editado' });

    const after = await mockApi.getUsers();
    const edited = after.find(u => u.id === targetId)!;
    expect(edited.name).toBe('Nombre editado');
    expect(edited.username).toBe(originalUsername);
  });

  it('throws when editing a non-existent user', async () => {
    await expect(mockApi.editUser('missing', { name: 'x' })).rejects.toThrow('Usuario no encontrado');
  });

  it('deletes an existing user', async () => {
    const before = await mockApi.getUsers();
    const targetId = before[0].id;

    await mockApi.deleteUser(targetId);

    const after = await mockApi.getUsers();
    expect(after.find(u => u.id === targetId)).toBeUndefined();
  });

  it('throws when deleting a non-existent user', async () => {
    await expect(mockApi.deleteUser('missing')).rejects.toThrow('Usuario no encontrado');
  });

  it('toggles isActive on an existing user', async () => {
    const before = await mockApi.getUsers();
    const targetId = before[0].id;
    const activeBefore = before[0].isActive;

    await mockApi.toggleUserStatus(targetId);

    const after = await mockApi.getUsers();
    const toggled = after.find(u => u.id === targetId)!;
    expect(toggled.isActive).toBe(!activeBefore);
  });

  it('throws when toggling status of a non-existent user', async () => {
    await expect(mockApi.toggleUserStatus('missing')).rejects.toThrow('Usuario no encontrado');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '@/api/api';
import { GuaranteesApi, MockGuaranteesApi } from '../GuaranteesApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('GuaranteesApi (real, axios-backed)', () => {
  let guaranteesApi: GuaranteesApi;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    guaranteesApi = new GuaranteesApi();
  });

  it('getGuarantees asks for the pending ones by default', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [{ orderId: 'o1' }] } });

    const result = await guaranteesApi.getGuarantees();

    expect(mockedApi.get).toHaveBeenCalledWith('/guarantees', { params: { status: 'pending' } });
    expect(result).toEqual([{ orderId: 'o1' }]);
  });

  it('getGuarantees can ask for the returned ones', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

    await guaranteesApi.getGuarantees('returned');

    expect(mockedApi.get).toHaveBeenCalledWith('/guarantees', { params: { status: 'returned' } });
  });

  it('getGuarantees surfaces the server message on failure', async () => {
    mockedApi.get.mockRejectedValue({ response: { data: { message: 'Acceso denegado' } } });

    await expect(guaranteesApi.getGuarantees()).rejects.toThrow('Acceso denegado');
  });

  it('returnGuarantee posts the amount and method to the order', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    await guaranteesApi.returnGuarantee('o1', { amount: 40, method: 'qr' });

    expect(mockedApi.post).toHaveBeenCalledWith('/guarantees/o1/return', { amount: 40, method: 'qr' });
  });

  it('returnGuarantee without data returns the whole guarantee (empty body)', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    await guaranteesApi.returnGuarantee('o1');

    expect(mockedApi.post).toHaveBeenCalledWith('/guarantees/o1/return', {});
  });

  it('returnGuarantee surfaces the server message (already returned)', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'La garantía de este pedido ya fue devuelta' } } });

    await expect(guaranteesApi.returnGuarantee('o1')).rejects.toThrow('ya fue devuelta');
  });
});

describe('MockGuaranteesApi', () => {
  it('starts empty and returns nothing to return', async () => {
    const mock = new MockGuaranteesApi();
    expect(await mock.getGuarantees('pending')).toEqual([]);
    await expect(mock.returnGuarantee('x')).resolves.toBeUndefined();
  });
});

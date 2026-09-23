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
import { AssemblyApi, MockAssemblyApi } from '../AssemblyApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('AssemblyApi (real, axios-backed)', () => {
  let assemblyApi: AssemblyApi;

  beforeEach(() => {
    vi.clearAllMocks();
    assemblyApi = new AssemblyApi();
  });

  describe('getAssemblyOrders', () => {
    it('gets /orders filtered to itemStage=assembling with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await assemblyApi.getAssemblyOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { itemStage: 'assembling', limit: 50 },
        signal: undefined,
      });
      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('forwards the abort signal when provided', async () => {
      const controller = new AbortController();
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await assemblyApi.getAssemblyOrders(controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { itemStage: 'assembling', limit: 50 },
        signal: controller.signal,
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener pedidos' } });

      await expect(assemblyApi.getAssemblyOrders()).rejects.toThrow('Error al obtener pedidos');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(assemblyApi.getAssemblyOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('updateOrderStatus', () => {
    it('patches /orders/:id/status with the new status and returns the mapped order', async () => {
      const raw = { id: '4', status: 'decorating', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await assemblyApi.updateOrderStatus('4', 'decorating');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/4/status', { status: 'decorating' });
      expect(result.status).toBe('decorating');
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el estado del pedido' } });

      await expect(assemblyApi.updateOrderStatus('4', 'decorating')).rejects.toThrow('Error al actualizar el estado del pedido');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(assemblyApi.updateOrderStatus('4', 'decorating')).rejects.toThrow('Network Error');
    });
  });

  describe('completeItem', () => {
    it('patches /orders/:id/items/:itemType/:itemId/advance with toStage=decorating and returns the mapped order', async () => {
      const raw = { id: '4', status: 'assembling', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await assemblyApi.completeItem('4', 'custom_cake', 'cake-3');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/4/items/custom_cake/cake-3/advance', { toStage: 'decorating' });
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
      expect(result.createdAt).toEqual(new Date(raw.createdAt));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar la etapa' } });

      await expect(assemblyApi.completeItem('4', 'custom_cake', 'cake-3')).rejects.toThrow('Error al actualizar la etapa');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(assemblyApi.completeItem('4', 'custom_cake', 'cake-3')).rejects.toThrow('Network Error');
    });
  });
});

describe('MockAssemblyApi (in-memory)', () => {
  let mockApi: MockAssemblyApi;

  beforeEach(() => {
    mockApi = new MockAssemblyApi();
  });

  it('returns only orders that have at least one item in the assembling stage', async () => {
    const orders = await mockApi.getAssemblyOrders();

    expect(orders.length).toBeGreaterThan(0);
    // Order '4' is the only mock order with a custom cake in the assembling stage.
    expect(orders.map(o => o.id)).toEqual(['4']);
  });

  it('updates the status of an existing order', async () => {
    const updated = await mockApi.updateOrderStatus('4', 'decorating');

    expect(updated.status).toBe('decorating');
  });

  it('throws when updating the status of a non-existent order', async () => {
    await expect(mockApi.updateOrderStatus('missing', 'decorating')).rejects.toThrow('Order with id missing not found');
  });

  it('completeItem returns the existing order without throwing', async () => {
    const result = await mockApi.completeItem('4', 'custom_cake', '3');

    expect(result.id).toBe('4');
  });

  it('throws when completing an item for a non-existent order', async () => {
    await expect(mockApi.completeItem('missing', 'custom_cake', '3')).rejects.toThrow('Order with id missing not found');
  });
}, 20000);

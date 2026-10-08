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
import { RestockApi, MockRestockApi } from '../RestockApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('RestockApi (real, axios-backed)', () => {
  let restockApi: RestockApi;

  beforeEach(() => {
    vi.clearAllMocks();
    restockApi = new RestockApi();
  });

  describe('getRestockOrders', () => {
    it('gets /orders filtered to orderType=restock and status=ready with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await restockApi.getRestockOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { orderType: 'restock', status: 'ready', limit: 50 },
        signal: undefined,
      });
      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('forwards the abort signal when provided', async () => {
      const controller = new AbortController();
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await restockApi.getRestockOrders(controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { orderType: 'restock', status: 'ready', limit: 50 },
        signal: controller.signal,
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener las reposiciones' } });

      await expect(restockApi.getRestockOrders()).rejects.toThrow('Error al obtener las reposiciones');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(restockApi.getRestockOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('confirmRestock', () => {
    it('patches /orders/:orderId/items/:itemId/confirm-restock with actualQuantity and returns the mapped order', async () => {
      const raw = { id: '1', status: 'delivered', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await restockApi.confirmRestock('1', 'item-1', 18);

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/1/items/item-1/confirm-restock', { actualQuantity: 18 });
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
      expect(result.createdAt).toEqual(new Date(raw.createdAt));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'La reposición todavía no está lista para confirmar' } });

      await expect(restockApi.confirmRestock('1', 'item-1', 18)).rejects.toThrow('La reposición todavía no está lista para confirmar');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(restockApi.confirmRestock('1', 'item-1', 18)).rejects.toThrow('Network Error');
    });
  });
});

describe('MockRestockApi (in-memory)', () => {
  let mockApi: MockRestockApi;

  beforeEach(() => {
    mockApi = new MockRestockApi();
  });

  it('returns an empty list when there are no seeded orders', async () => {
    const orders = await mockApi.getRestockOrders();
    expect(orders).toEqual([]);
  });

  it('throws when confirming restock for a non-existent order', async () => {
    await expect(mockApi.confirmRestock('missing', 'item-1', 18)).rejects.toThrow('Order not found');
  });
});

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
import { BakingApi, MockBakingApi } from '../BakingApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('BakingApi (real, axios-backed)', () => {
  let bakingApi: BakingApi;

  beforeEach(() => {
    vi.clearAllMocks();
    bakingApi = new BakingApi();
  });

  describe('getBakingOrders', () => {
    it('gets /orders filtered to status=baking with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await bakingApi.getBakingOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { status: 'baking', limit: 50 },
        signal: undefined,
      });
      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('forwards the abort signal when provided', async () => {
      const controller = new AbortController();
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await bakingApi.getBakingOrders(controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { status: 'baking', limit: 50 },
        signal: controller.signal,
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener pedidos' } });

      await expect(bakingApi.getBakingOrders()).rejects.toThrow('Error al obtener pedidos');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(bakingApi.getBakingOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('getBakedProductsStock', () => {
    it('gets /inventory/baked-products and maps date fields', async () => {
      const raw = [
        { id: '1', name: 'Base chocolate', lastUpdated: '2026-01-01T00:00:00.000Z', expiresAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', name: 'Base vainilla', lastUpdated: '2026-01-01T00:00:00.000Z', expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await bakingApi.getBakedProductsStock();

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/baked-products');
      expect(result[0].lastUpdated).toEqual(new Date(raw[0].lastUpdated));
      expect(result[0].expiresAt).toEqual(new Date(raw[0].expiresAt as string));
      expect(result[1].expiresAt).toBeUndefined();
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener stock de productos horneados' } });

      await expect(bakingApi.getBakedProductsStock()).rejects.toThrow('Error al obtener stock de productos horneados');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(bakingApi.getBakedProductsStock()).rejects.toThrow('Network Error');
    });
  });

  describe('updateOrderStatus', () => {
    it('patches /orders/:id/status with the new status and returns the mapped order', async () => {
      const raw = { id: '1', status: 'baking', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await bakingApi.updateOrderStatus('1', 'baking');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/1/status', { status: 'baking' });
      expect(result.status).toBe('baking');
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el estado del pedido' } });

      await expect(bakingApi.updateOrderStatus('1', 'baking')).rejects.toThrow('Error al actualizar el estado del pedido');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(bakingApi.updateOrderStatus('1', 'baking')).rejects.toThrow('Network Error');
    });
  });

  describe('completeBaking', () => {
    it('patches /orders/:id/status with status=assembling', async () => {
      const raw = { id: '1', status: 'assembling', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      await bakingApi.completeBaking('1', new Map([['Chocolate', 5]]));

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/1/status', { status: 'assembling' });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el estado' } });

      await expect(bakingApi.completeBaking('1', new Map())).rejects.toThrow('Error al actualizar el estado');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(bakingApi.completeBaking('1', new Map())).rejects.toThrow('Network Error');
    });
  });
});

describe('MockBakingApi (in-memory)', () => {
  let mockApi: MockBakingApi;

  beforeEach(() => {
    mockApi = new MockBakingApi();
  });

  it('returns only orders with status pending or baking', async () => {
    const orders = await mockApi.getBakingOrders();

    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every(o => o.status === 'pending' || o.status === 'baking')).toBe(true);
  });

  it('returns only cake_base baked products for stock', async () => {
    const stock = await mockApi.getBakedProductsStock();

    expect(stock.length).toBeGreaterThan(0);
    expect(stock.every(p => p.type === 'cake_base')).toBe(true);
  });

  it('updates the status of an existing order', async () => {
    const updated = await mockApi.updateOrderStatus('1', 'baking');

    expect(updated.status).toBe('baking');
  });

  it('throws when updating the status of a non-existent order', async () => {
    await expect(mockApi.updateOrderStatus('missing', 'baking')).rejects.toThrow('Order with id missing not found');
  });

  it('completeBaking moves the order to assembling and increases matching stock', async () => {
    const stockBefore = await mockApi.getBakedProductsStock();
    // Snapshot the quantity as a primitive — `find` returns a reference to the
    // same in-memory object that completeBaking mutates, so reading
    // `chocolateBefore.quantity` after the mutation would already reflect the
    // new value.
    const chocolateBeforeQty = stockBefore.find(p => p.name.includes('chocolate'))!.quantity;

    await mockApi.completeBaking('1', new Map([['chocolate', 4]]));

    const updated = await mockApi.updateOrderStatus('1', 'assembling');
    expect(updated.status).toBe('assembling');

    const stockAfter = await mockApi.getBakedProductsStock();
    const chocolateAfter = stockAfter.find(p => p.name.includes('chocolate'));
    expect(chocolateAfter!.quantity).toBe(chocolateBeforeQty + 4);
  });
}, 20000);

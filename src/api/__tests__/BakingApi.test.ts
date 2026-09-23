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
    it('gets /orders filtered to itemStage=baking with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await bakingApi.getBakingOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { itemStage: 'baking', limit: 50 },
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
        params: { itemStage: 'baking', limit: 50 },
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

  describe('completeItem', () => {
    it('patches /orders/:id/items/:itemType/:itemId/advance with toStage=assembling and returns the mapped order', async () => {
      const raw = { id: '1', status: 'baking', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await bakingApi.completeItem('1', 'custom_cake', 'cake-1');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/1/items/custom_cake/cake-1/advance', { toStage: 'assembling' });
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
      expect(result.createdAt).toEqual(new Date(raw.createdAt));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar la etapa' } });

      await expect(bakingApi.completeItem('1', 'custom_cake', 'cake-1')).rejects.toThrow('Error al actualizar la etapa');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(bakingApi.completeItem('1', 'custom_cake', 'cake-1')).rejects.toThrow('Network Error');
    });
  });
});

describe('MockBakingApi (in-memory)', () => {
  let mockApi: MockBakingApi;

  beforeEach(() => {
    mockApi = new MockBakingApi();
  });

  it('returns only orders that have at least one item in the baking stage', async () => {
    const orders = await mockApi.getBakingOrders();

    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every(o =>
      o.customCakes.some(c => c.status === 'baking') ||
      (o.items || []).some(i => i.status === 'baking') ||
      (o.sweetTableCombos || []).some(combo => combo.products.some(p => p.status === 'baking')) ||
      (o.sweetTableExtras || []).some(e => e.status === 'baking')
    )).toBe(true);
    // Order '1' is the only mock order with a custom cake in the baking stage.
    expect(orders.map(o => o.id)).toEqual(['1']);
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

  it('completeItem returns the existing order without throwing', async () => {
    const result = await mockApi.completeItem('1', 'custom_cake', '1');

    expect(result.id).toBe('1');
  });

  it('throws when completing an item for a non-existent order', async () => {
    await expect(mockApi.completeItem('missing', 'custom_cake', '1')).rejects.toThrow('Order with id missing not found');
  });
}, 20000);

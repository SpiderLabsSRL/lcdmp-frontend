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
import { DecorationApi, MockDecorationApi } from '../DecorationApi';
import type { Order } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('DecorationApi (real, axios-backed)', () => {
  let decorationApi: DecorationApi;

  beforeEach(() => {
    vi.clearAllMocks();
    decorationApi = new DecorationApi();
  });

  describe('getDecorationOrders', () => {
    it('gets /orders filtered to itemStage=decorating with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await decorationApi.getDecorationOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { itemStage: 'decorating', limit: 50 },
        signal: undefined,
      });
      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('forwards the abort signal when provided', async () => {
      const controller = new AbortController();
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await decorationApi.getDecorationOrders(controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { itemStage: 'decorating', limit: 50 },
        signal: controller.signal,
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener pedidos' } });

      await expect(decorationApi.getDecorationOrders()).rejects.toThrow('Error al obtener pedidos');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(decorationApi.getDecorationOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('completeItem', () => {
    it('patches /orders/:id/items/:itemType/:itemId/advance with toStage=ready and returns the mapped order', async () => {
      const raw = { id: '3', status: 'decorating', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await decorationApi.completeItem('3', 'custom_cake', 'cake-2');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/3/items/custom_cake/cake-2/advance', { toStage: 'ready' });
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
      expect(result.createdAt).toEqual(new Date(raw.createdAt));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar la etapa' } });

      await expect(decorationApi.completeItem('3', 'custom_cake', 'cake-2')).rejects.toThrow('Error al actualizar la etapa');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(decorationApi.completeItem('3', 'custom_cake', 'cake-2')).rejects.toThrow('Network Error');
    });
  });

  describe('getOrderDetails', () => {
    it('gets /orders/:id and returns the order data', async () => {
      const order = { id: '3', customerName: 'Ana' };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: order } });

      const result = await decorationApi.getOrderDetails('3');

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/3');
      expect(result).toEqual(order);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener detalles del pedido' } });

      await expect(decorationApi.getOrderDetails('3')).rejects.toThrow('Error al obtener detalles del pedido');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(decorationApi.getOrderDetails('3')).rejects.toThrow('Network Error');
    });
  });
});

describe('MockDecorationApi (in-memory)', () => {
  let mockApi: MockDecorationApi;

  const baseOrders = [
    { id: '1', status: 'decorating', pickupDate: new Date(2026, 2, 10), customCakes: [{ id: 'c1', status: 'decorating' }] },
    { id: '2', status: 'decorating', pickupDate: new Date(2026, 2, 5), customCakes: [{ id: 'c2', status: 'decorating' }] },
    { id: '3', status: 'pending', pickupDate: new Date(2026, 2, 1), customCakes: [{ id: 'c3', status: 'pending' }] },
  ] as unknown as Order[];

  beforeEach(() => {
    mockApi = new MockDecorationApi();
    mockApi.setMockOrders(baseOrders);
  });

  it('returns only orders with status decorating, sorted by nearest pickupDate first', async () => {
    const orders = await mockApi.getDecorationOrders();

    expect(orders.map(o => o.id)).toEqual(['2', '1']);
  });

  it('completeItem returns the existing order without throwing', async () => {
    const result = await mockApi.completeItem('1', 'custom_cake', 'c1');

    expect(result.id).toBe('1');
  });

  it('throws when completing an item for a non-existent order', async () => {
    await expect(mockApi.completeItem('missing', 'custom_cake', 'c1')).rejects.toThrow('Order not found');
  });

  it('returns order details for an existing order', async () => {
    const details = await mockApi.getOrderDetails('3');

    expect(details.id).toBe('3');
  });

  it('throws when getting details of a non-existent order', async () => {
    await expect(mockApi.getOrderDetails('missing')).rejects.toThrow('Order not found');
  });
});

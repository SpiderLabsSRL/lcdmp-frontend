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
    it('gets /orders filtered to status=decorating with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await decorationApi.getDecorationOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { status: 'decorating', limit: 50 },
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
        params: { status: 'decorating', limit: 50 },
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

  describe('completeDecoration', () => {
    it('patches /orders/:id/status with status=ready', async () => {
      const raw = { id: '3', status: 'ready', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      await decorationApi.completeDecoration('3', 'listo');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/3/status', { status: 'ready' });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el estado' } });

      await expect(decorationApi.completeDecoration('3')).rejects.toThrow('Error al actualizar el estado');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(decorationApi.completeDecoration('3')).rejects.toThrow('Network Error');
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
    { id: '1', status: 'decorating', pickupDate: new Date(2026, 2, 10) },
    { id: '2', status: 'decorating', pickupDate: new Date(2026, 2, 5) },
    { id: '3', status: 'pending', pickupDate: new Date(2026, 2, 1) },
  ] as unknown as Order[];

  beforeEach(() => {
    mockApi = new MockDecorationApi();
    mockApi.setMockOrders(baseOrders);
  });

  it('returns only orders with status decorating, sorted by nearest pickupDate first', async () => {
    const orders = await mockApi.getDecorationOrders();

    expect(orders.map(o => o.id)).toEqual(['2', '1']);
  });

  it('completes decoration and moves the order to ready', async () => {
    await mockApi.completeDecoration('1', 'notas');

    const orders = await mockApi.getDecorationOrders();
    expect(orders.some(o => o.id === '1')).toBe(false);

    const details = await mockApi.getOrderDetails('1');
    expect(details.status).toBe('ready');
  });

  it('throws when completing decoration for a non-existent order', async () => {
    await expect(mockApi.completeDecoration('missing')).rejects.toThrow('Order not found');
  });

  it('returns order details for an existing order', async () => {
    const details = await mockApi.getOrderDetails('3');

    expect(details.id).toBe('3');
  });

  it('throws when getting details of a non-existent order', async () => {
    await expect(mockApi.getOrderDetails('missing')).rejects.toThrow('Order not found');
  });
});

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
import { DeliveryApi } from '../DeliveryApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('DeliveryApi (real, axios-backed)', () => {
  let deliveryApi: DeliveryApi;

  beforeEach(() => {
    vi.clearAllMocks();
    deliveryApi = new DeliveryApi();
  });

  describe('getDeliveryOrders', () => {
    it('gets /orders filtered to status=ready with a limit and maps dates', async () => {
      const rawOrders = [
        { id: '5', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' },
      ];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await deliveryApi.getDeliveryOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { status: 'ready', excludeOrderType: 'restock', limit: 50 },
        signal: undefined,
      });
      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('forwards the abort signal when provided', async () => {
      const controller = new AbortController();
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await deliveryApi.getDeliveryOrders(controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: { status: 'ready', excludeOrderType: 'restock', limit: 50 },
        signal: controller.signal,
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener pedidos de entrega' } });

      await expect(deliveryApi.getDeliveryOrders()).rejects.toThrow('Error al obtener pedidos de entrega');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(deliveryApi.getDeliveryOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('completeDelivery', () => {
    it('patches /orders/:id/status with status=delivered and returns the mapped order', async () => {
      const raw = { id: '5', status: 'delivered', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await deliveryApi.completeDelivery('5');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/5/status', { status: 'delivered' });
      expect(result.status).toBe('delivered');
      expect(result.pickupDate).toEqual(new Date(raw.pickupDate));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al completar la entrega' } });

      await expect(deliveryApi.completeDelivery('5')).rejects.toThrow('Error al completar la entrega');
    });

    it('throws a default message on network error', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(deliveryApi.completeDelivery('5')).rejects.toThrow('Network Error');
    });
  });
});

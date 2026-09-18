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
import { OrdersApi, MockOrdersApi } from '../OrdersApi';
import type { CreateOrderData, OrderFilters, UpdateOrderData } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('OrdersApi (real, axios-backed)', () => {
  let ordersApi: OrdersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    ordersApi = new OrdersApi();
  });

  describe('getOrders', () => {
    it('gets /orders with empty params when no filters are given', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await ordersApi.getOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', { params: {}, signal: undefined });
    });

    it('sends every filter field, converting dates to ISO strings', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });
      const filters: OrderFilters = {
        status: 'pending',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-31T00:00:00.000Z'),
        customerName: 'María',
        customerPhone: '7123',
      };
      const controller = new AbortController();

      await ordersApi.getOrders(filters, controller.signal);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: {
          status: 'pending',
          startDate: filters.startDate!.toISOString(),
          endDate: filters.endDate!.toISOString(),
          customerName: 'María',
          customerPhone: '7123',
        },
        signal: controller.signal,
      });
    });

    it('maps pickupDate (local, from Y-M-D) and createdAt on each order', async () => {
      const rawOrders = [{ id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: rawOrders } });

      const result = await ordersApi.getOrders();

      expect(result[0].pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener pedidos' } });

      await expect(ordersApi.getOrders()).rejects.toThrow('Error al obtener pedidos');
    });

    it('re-throws the original error unchanged when the request was canceled', async () => {
      const cancelError = Object.assign(new Error('canceled'), { name: 'CanceledError' });
      mockedApi.get.mockRejectedValue(cancelError);

      await expect(ordersApi.getOrders()).rejects.toBe(cancelError);
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.getOrders()).rejects.toThrow('Network Error');
    });
  });

  describe('getOrderById', () => {
    it('gets /orders/:id and maps dates', async () => {
      const raw = { id: '1', pickupDate: '2026-03-05', createdAt: '2026-01-01T10:00:00.000Z' };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await ordersApi.getOrderById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/1');
      expect(result.pickupDate).toEqual(new Date(2026, 2, 5));
      expect(result.createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener el pedido' } });

      await expect(ordersApi.getOrderById('1')).rejects.toThrow('Error al obtener el pedido');
    });

    it('throws a default message on network error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.getOrderById('1')).rejects.toThrow('Network Error');
    });
  });

  describe('createOrder', () => {
    const orderData: CreateOrderData = {
      orderType: 'cake',
      customerName: 'María García',
      customerPhone: '71234567',
      pickupDate: new Date('2026-03-05'),
      pickupTime: '14:00',
      deposit: 100,
    };

    it('posts the order data and maps dates on the created order', async () => {
      const created = { id: '10', ...orderData, pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.post.mockResolvedValue({ data: { success: true, data: created }, status: 201 });

      const result = await ordersApi.createOrder(orderData);

      expect(mockedApi.post).toHaveBeenCalledWith('/orders', orderData);
      expect(result.pickupDate).toEqual(new Date(created.pickupDate));
      expect(result.createdAt).toEqual(new Date(created.createdAt));
    });

    it('does not throw when success is false but status is 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, data: { pickupDate: '2026-03-05', createdAt: '2026-01-01' } }, status: 201 });

      await expect(ordersApi.createOrder(orderData)).resolves.toBeDefined();
    });

    it('throws with the backend message when success is false and status is not 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Error al crear el pedido' }, status: 400 });

      await expect(ordersApi.createOrder(orderData)).rejects.toThrow('Error al crear el pedido');
    });

    it('throws a default message on network error', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.createOrder(orderData)).rejects.toThrow('Network Error');
    });
  });

  describe('updateOrder', () => {
    const data: UpdateOrderData = { customerName: 'Nuevo nombre' };

    it('puts to /orders/:id and maps dates on the updated order', async () => {
      const updated = { id: '1', customerName: 'Nuevo nombre', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.put.mockResolvedValue({ data: { success: true, data: updated } });

      const result = await ordersApi.updateOrder('1', data);

      expect(mockedApi.put).toHaveBeenCalledWith('/orders/1', data);
      expect(result.customerName).toBe('Nuevo nombre');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.put.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el pedido' } });

      await expect(ordersApi.updateOrder('1', data)).rejects.toThrow('Error al actualizar el pedido');
    });

    it('throws a default message on network error', async () => {
      mockedApi.put.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.updateOrder('1', data)).rejects.toThrow('Network Error');
    });
  });

  describe('deleteOrder', () => {
    it('deletes /orders/:id', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: true } });

      await ordersApi.deleteOrder('1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/orders/1');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: false, message: 'Error al eliminar el pedido' } });

      await expect(ordersApi.deleteOrder('1')).rejects.toThrow('Error al eliminar el pedido');
    });

    it('throws a default message on network error', async () => {
      mockedApi.delete.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.deleteOrder('1')).rejects.toThrow('Network Error');
    });
  });

  describe('updateOrderStatus', () => {
    it('patches /orders/:id/status with status and paymentMethod', async () => {
      const raw = { id: '1', status: 'baking', pickupDate: '2026-03-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: raw } });

      const result = await ordersApi.updateOrderStatus('1', 'baking', 'cash');

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/1/status', { status: 'baking', paymentMethod: 'cash' });
      expect(result.status).toBe('baking');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al actualizar el estado' } });

      await expect(ordersApi.updateOrderStatus('1', 'baking')).rejects.toThrow('Error al actualizar el estado');
    });

    it('throws a default message on network error', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.updateOrderStatus('1', 'baking')).rejects.toThrow('Network Error');
    });
  });

  describe('getFlavors', () => {
    it('gets /products/flavors and returns the list', async () => {
      const flavors = [{ id: '1', name: 'Chocolate' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: flavors } });

      const result = await ordersApi.getFlavors();

      expect(mockedApi.get).toHaveBeenCalledWith('/products/flavors');
      expect(result).toEqual(flavors);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener sabores' } });

      await expect(ordersApi.getFlavors()).rejects.toThrow('Error al obtener sabores');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.getFlavors()).rejects.toThrow('Network Error');
    });
  });

  describe('getProducts', () => {
    it('gets /products with an undefined search param when no term is given', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await ordersApi.getProducts();

      expect(mockedApi.get).toHaveBeenCalledWith('/products', { params: { search: undefined } });
    });

    it('gets /products with the given search term', async () => {
      const products = [{ id: '4', name: 'Cupcake' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: products } });

      const result = await ordersApi.getProducts('cupcake');

      expect(mockedApi.get).toHaveBeenCalledWith('/products', { params: { search: 'cupcake' } });
      expect(result).toEqual(products);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener productos' } });

      await expect(ordersApi.getProducts()).rejects.toThrow('Error al obtener productos');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.getProducts()).rejects.toThrow('Network Error');
    });
  });

  describe('getSweetTableCombos', () => {
    it('gets /sweet-table-combos and returns the list', async () => {
      const combos = [{ id: '1', name: 'Combo 50' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: combos } });

      const result = await ordersApi.getSweetTableCombos();

      expect(mockedApi.get).toHaveBeenCalledWith('/sweet-table-combos');
      expect(result).toEqual(combos);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener las mesas dulces' } });

      await expect(ordersApi.getSweetTableCombos()).rejects.toThrow('Error al obtener las mesas dulces');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(ordersApi.getSweetTableCombos()).rejects.toThrow('Network Error');
    });
  });
});

describe('MockOrdersApi (in-memory)', () => {
  let mockApi: MockOrdersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = new MockOrdersApi();
  });

  describe('getOrders', () => {
    it('returns the seeded orders when no filters are given', async () => {
      const orders = await mockApi.getOrders();
      expect(orders.length).toBeGreaterThan(0);
    });

    it('filters by status', async () => {
      const orders = await mockApi.getOrders({ status: 'pending' });
      expect(orders.every(o => o.status === 'pending')).toBe(true);
    });

    it('filters by customerName (case-insensitive substring)', async () => {
      const orders = await mockApi.getOrders({ customerName: 'garcía' });
      expect(orders.every(o => o.customerName.toLowerCase().includes('garcía'))).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
    });

    it('filters by customerPhone', async () => {
      const orders = await mockApi.getOrders({ customerPhone: '7123' });
      expect(orders.every(o => o.customerPhone.includes('7123'))).toBe(true);
    });
  });

  describe('getOrderById', () => {
    it('returns an existing order', async () => {
      const order = await mockApi.getOrderById('1');
      expect(order.id).toBe('1');
    });

    it('throws when the order does not exist', async () => {
      await expect(mockApi.getOrderById('missing')).rejects.toThrow('Order with id missing not found');
    });
  });

  describe('createOrder', () => {
    it('creates an order, computing the total from items, delivery cost and discount', async () => {
      const orderData: CreateOrderData = {
        orderType: 'products',
        customerName: 'Cliente Nuevo',
        customerPhone: '70000000',
        pickupDate: new Date(),
        pickupTime: '10:00',
        deposit: 0,
        deliveryCost: 20,
        discount: 5,
        items: [{ productId: '1', product: {} as any, quantity: 2, price: 50 }],
      };

      const created = await mockApi.createOrder(orderData);

      expect(created.status).toBe('pending');
      expect(created.total).toBe(2 * 50 + 20 - 5);

      const all = await mockApi.getOrders();
      expect(all.find(o => o.id === created.id)).toBeDefined();
    });
  });

  describe('updateOrder', () => {
    it('updates an existing order and recomputes the total from the merged fields', async () => {
      // Order '1' starts with customCakes totaling 450 and deliveryCost 30 (total 480).
      // Replacing items while zeroing customCakes/deliveryCost isolates the new total to just the items.
      const updated = await mockApi.updateOrder('1', {
        items: [{ productId: '4', product: {} as any, quantity: 10, price: 15 }],
        customCakes: [],
        deliveryCost: 0,
      });

      expect(updated.total).toBe(150);
    });

    it('throws when updating a non-existent order', async () => {
      await expect(mockApi.updateOrder('missing', {})).rejects.toThrow('Order with id missing not found');
    });
  });

  describe('deleteOrder', () => {
    it('deletes an existing order', async () => {
      await mockApi.deleteOrder('1');
      await expect(mockApi.getOrderById('1')).rejects.toThrow('Order with id 1 not found');
    });

    it('throws when deleting a non-existent order', async () => {
      await expect(mockApi.deleteOrder('missing')).rejects.toThrow('Order with id missing not found');
    });
  });

  describe('updateOrderStatus', () => {
    it('updates the status of an existing order', async () => {
      const updated = await mockApi.updateOrderStatus('1', 'assembling');
      expect(updated.status).toBe('assembling');
    });

    it('throws when updating the status of a non-existent order', async () => {
      await expect(mockApi.updateOrderStatus('missing', 'assembling')).rejects.toThrow('Order with id missing not found');
    });
  });

  describe('getFlavors', () => {
    it('delegates to the axios client and returns the flavor list', async () => {
      const flavors = [{ id: '1', name: 'Chocolate' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: flavors } });

      const result = await mockApi.getFlavors();

      expect(mockedApi.get).toHaveBeenCalledWith('/products/flavors');
      expect(result).toEqual(flavors);
    });

    it('throws with a connection error when the underlying request fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(mockApi.getFlavors()).rejects.toThrow('Network Error');
    });
  });

  describe('getProducts', () => {
    it('returns the local product catalog filtered by search term', async () => {
      const products = await mockApi.getProducts('cupcake');
      expect(products.every(p =>
        p.name.toLowerCase().includes('cupcake') || (p.description ?? '').toLowerCase().includes('cupcake')
      )).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    });

    it('returns the full catalog when no search term is given', async () => {
      const products = await mockApi.getProducts();
      expect(products.length).toBeGreaterThan(0);
    });
  });

  describe('getSweetTableCombos', () => {
    it('returns the local combo catalog', async () => {
      const combos = await mockApi.getSweetTableCombos();
      expect(combos.length).toBeGreaterThan(0);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });
});

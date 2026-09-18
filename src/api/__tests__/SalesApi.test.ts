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
import { SalesApi, MockSalesApi, type SaleData } from '../SalesApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('SalesApi (real, axios-backed)', () => {
  let salesApi: SalesApi;

  beforeEach(() => {
    vi.clearAllMocks();
    salesApi = new SalesApi();
  });

  describe('getProducts', () => {
    it('gets /sales/products with an undefined search param when no term is given', async () => {
      const products = [{ id: '1', name: 'Torta' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: products } });

      const result = await salesApi.getProducts();

      expect(mockedApi.get).toHaveBeenCalledWith('/sales/products', { params: { search: undefined } });
      expect(result).toEqual(products);
    });

    it('gets /sales/products with the given search term', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await salesApi.getProducts('choco');

      expect(mockedApi.get).toHaveBeenCalledWith('/sales/products', { params: { search: 'choco' } });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener productos' } });

      await expect(salesApi.getProducts()).rejects.toThrow('Error al obtener productos');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(salesApi.getProducts()).rejects.toThrow('Network Error');
    });
  });

  describe('createSale', () => {
    const sale: SaleData = {
      items: [{ productId: '1', quantity: 2, price: 15 }],
      total: 30,
      paymentMethod: 'cash',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('posts only items/total/paymentMethod and resolves on success', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: true }, status: 200 });

      await expect(salesApi.createSale(sale)).resolves.toBeUndefined();

      expect(mockedApi.post).toHaveBeenCalledWith('/sales', {
        items: sale.items,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
      });
    });

    it('does not throw when success is false but status is 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false }, status: 201 });

      await expect(salesApi.createSale(sale)).resolves.toBeUndefined();
    });

    it('throws with the backend message when success is false and status is not 201', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Error al crear la venta' }, status: 400 });

      await expect(salesApi.createSale(sale)).rejects.toThrow('Error al crear la venta');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(salesApi.createSale(sale)).rejects.toThrow('Network Error');
    });
  });
});

describe('MockSalesApi (in-memory)', () => {
  let mockApi: MockSalesApi;

  beforeEach(() => {
    mockApi = new MockSalesApi();
  });

  it('returns only active, in-store products with stock', async () => {
    const products = await mockApi.getProducts();

    expect(products.length).toBeGreaterThan(0);
    expect(products.every(p => p.isActive && p.location === 'store' && p.stock > 0)).toBe(true);
  });

  it('filters products by search term (case-insensitive)', async () => {
    const products = await mockApi.getProducts('chocolate');

    expect(products.length).toBeGreaterThan(0);
    expect(products.every(p => p.name.toLowerCase().includes('chocolate'))).toBe(true);
  });

  it('returns an empty array when the search term matches nothing', async () => {
    const products = await mockApi.getProducts('producto-inexistente-xyz');

    expect(products).toEqual([]);
  });

  it('createSale resolves without throwing', async () => {
    await expect(
      mockApi.createSale({
        items: [{ productId: '1', quantity: 1, price: 10 }],
        total: 10,
        paymentMethod: 'cash',
        timestamp: new Date(),
      })
    ).resolves.toBeUndefined();
  });
});

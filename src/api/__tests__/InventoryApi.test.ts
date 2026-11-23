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
import { InventoryApi, MockInventoryApi } from '../InventoryApi';
import type { CreateRawMaterialData } from '../InventoryApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('InventoryApi (real, axios-backed)', () => {
  let inventoryApi: InventoryApi;

  beforeEach(() => {
    vi.clearAllMocks();
    inventoryApi = new InventoryApi();
  });

  describe('getRawMaterials', () => {
    it('gets with empty params when no filters are given', async () => {
      const materials = [{ id: '1', name: 'Harina' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: materials } });

      const result = await inventoryApi.getRawMaterials();

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/raw-materials', { params: {} });
      expect(result).toEqual(materials);
    });

    it('sends category, search and lowStock params when provided', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await inventoryApi.getRawMaterials({ category: 'flour', searchTerm: 'harina', lowStockOnly: true });

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/raw-materials', {
        params: { category: 'flour', search: 'harina', lowStock: true },
      });
    });

    it('omits the category param when category is "all"', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await inventoryApi.getRawMaterials({ category: 'all' });

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/raw-materials', { params: {} });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener materias primas' } });

      await expect(inventoryApi.getRawMaterials()).rejects.toThrow('Error al obtener materias primas');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.getRawMaterials()).rejects.toThrow('Network Error');
    });
  });

  describe('getRawMaterialById', () => {
    it('gets /inventory/raw-materials/:id', async () => {
      const material = { id: '1', name: 'Harina' };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: material } });

      const result = await inventoryApi.getRawMaterialById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/raw-materials/1');
      expect(result).toEqual(material);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener materia prima' } });

      await expect(inventoryApi.getRawMaterialById('1')).rejects.toThrow('Error al obtener materia prima');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.getRawMaterialById('1')).rejects.toThrow('Network Error');
    });
  });

  describe('createRawMaterial', () => {
    const payload: CreateRawMaterialData = {
      name: 'Harina',
      unit: 'kg',
      quantity: 50,
      minStock: 10,
      category: 'flour',
    };

    it('posts to /inventory/raw-materials and returns the created material', async () => {
      const created = { id: 'new-id', ...payload };
      mockedApi.post.mockResolvedValue({ data: { success: true, data: created } });

      const result = await inventoryApi.createRawMaterial(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/inventory/raw-materials', payload);
      expect(result).toEqual(created);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Error al crear materia prima' } });

      await expect(inventoryApi.createRawMaterial(payload)).rejects.toThrow('Error al crear materia prima');
    });

    it('throws a default message on network error', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.createRawMaterial(payload)).rejects.toThrow('Network Error');
    });
  });

  describe('updateRawMaterial', () => {
    it('puts to /inventory/raw-materials/:id with the partial data', async () => {
      const updated = { id: '1', name: 'Harina Integral' };
      mockedApi.put.mockResolvedValue({ data: { success: true, data: updated } });

      const result = await inventoryApi.updateRawMaterial('1', { name: 'Harina Integral' });

      expect(mockedApi.put).toHaveBeenCalledWith('/inventory/raw-materials/1', { name: 'Harina Integral' });
      expect(result).toEqual(updated);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.put.mockResolvedValue({ data: { success: false, message: 'Error al actualizar materia prima' } });

      await expect(inventoryApi.updateRawMaterial('1', {})).rejects.toThrow('Error al actualizar materia prima');
    });

    it('throws a default message on network error', async () => {
      mockedApi.put.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.updateRawMaterial('1', {})).rejects.toThrow('Network Error');
    });
  });

  describe('deleteRawMaterial', () => {
    it('deletes /inventory/raw-materials/:id', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: true } });

      await inventoryApi.deleteRawMaterial('1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/inventory/raw-materials/1');
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: false, message: 'Error al eliminar materia prima' } });

      await expect(inventoryApi.deleteRawMaterial('1')).rejects.toThrow('Error al eliminar materia prima');
    });

    it('throws a default message on network error', async () => {
      mockedApi.delete.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.deleteRawMaterial('1')).rejects.toThrow('Network Error');
    });
  });

  describe('adjustRawMaterialStock', () => {
    it('patches /inventory/raw-materials/:id/stock with the quantity delta', async () => {
      const adjusted = { id: '1', quantity: 60 };
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: adjusted } });

      const result = await inventoryApi.adjustRawMaterialStock('1', 10);

      expect(mockedApi.patch).toHaveBeenCalledWith('/inventory/raw-materials/1/stock', { quantity: 10 });
      expect(result).toEqual(adjusted);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: false, message: 'Error al ajustar stock' } });

      await expect(inventoryApi.adjustRawMaterialStock('1', 10)).rejects.toThrow('Error al ajustar stock');
    });

    it('throws a default message on network error', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Network Error'));

      await expect(inventoryApi.adjustRawMaterialStock('1', 10)).rejects.toThrow('Network Error');
    });
  });

  describe('getCategories', () => {
    it('returns the static inventory categories without calling the API', async () => {
      const result = await inventoryApi.getCategories();

      expect(mockedApi.get).not.toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getLowStockItems', () => {
    it('gets the low-stock raw materials and baked dough from the single low-stock endpoint', async () => {
      const summary = { rawMaterials: [{ id: 'r1' }], bakedProducts: [{ id: 'b1' }, { id: 'b2' }], totalLowStock: 3 };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: summary } });

      const result = await inventoryApi.getLowStockItems();

      expect(mockedApi.get).toHaveBeenCalledWith('/inventory/low-stock');
      expect(result).toEqual(summary);
    });

    it('propagates an error from either underlying call', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener el stock bajo' } });

      await expect(inventoryApi.getLowStockItems()).rejects.toThrow('Error al obtener el stock bajo');
    });
  });
});

describe('MockInventoryApi (in-memory)', () => {
  let mockApi: MockInventoryApi;

  beforeEach(() => {
    mockApi = new MockInventoryApi();
  });

  describe('raw materials', () => {
    it('seeds with a default set of raw materials', async () => {
      const materials = await mockApi.getRawMaterials();

      expect(materials.length).toBeGreaterThan(0);
    });

    it('filters by category, searchTerm and lowStockOnly', async () => {
      const byCategory = await mockApi.getRawMaterials({ category: 'flour' });
      expect(byCategory.every(m => m.category === 'flour')).toBe(true);

      const bySearch = await mockApi.getRawMaterials({ searchTerm: 'leche' });
      expect(bySearch.every(m => m.name.toLowerCase().includes('leche'))).toBe(true);

      const lowStock = await mockApi.getRawMaterials({ lowStockOnly: true });
      expect(lowStock.every(m => m.quantity <= m.minStock)).toBe(true);
    });

    it('gets a raw material by id', async () => {
      const material = await mockApi.getRawMaterialById('1');
      expect(material.id).toBe('1');
    });

    it('throws when a raw material id does not exist', async () => {
      await expect(mockApi.getRawMaterialById('missing')).rejects.toThrow('Materia prima no encontrada');
    });

    it('creates a raw material and appends it to the list', async () => {
      const created = await mockApi.createRawMaterial({
        name: 'Polvo de hornear',
        unit: 'kg',
        quantity: 5,
        minStock: 1,
        category: 'other',
      });

      expect(created.name).toBe('Polvo de hornear');
      const all = await mockApi.getRawMaterials();
      expect(all.find(m => m.id === created.id)).toBeDefined();
    });

    it('updates a raw material by id', async () => {
      const updated = await mockApi.updateRawMaterial('1', { quantity: 99 });
      expect(updated.quantity).toBe(99);
    });

    it('throws when updating a non-existent raw material', async () => {
      await expect(mockApi.updateRawMaterial('missing', { quantity: 1 })).rejects.toThrow('Materia prima no encontrada');
    });

    it('deletes a raw material by id', async () => {
      await mockApi.deleteRawMaterial('1');
      await expect(mockApi.getRawMaterialById('1')).rejects.toThrow('Materia prima no encontrada');
    });

    it('throws when deleting a non-existent raw material', async () => {
      await expect(mockApi.deleteRawMaterial('missing')).rejects.toThrow('Materia prima no encontrada');
    });

    it('adjusts stock by a positive delta', async () => {
      const before = await mockApi.getRawMaterialById('1');
      const qtyBefore = before.quantity;

      const adjusted = await mockApi.adjustRawMaterialStock('1', 10);

      expect(adjusted.quantity).toBe(qtyBefore + 10);
    });

    it('clamps stock at zero when the delta would go negative', async () => {
      const before = await mockApi.getRawMaterialById('3'); // quantity 15
      const qtyBefore = before.quantity;

      const adjusted = await mockApi.adjustRawMaterialStock('3', -(qtyBefore + 100));

      expect(adjusted.quantity).toBe(0);
    });
  });

  describe('getCategories', () => {
    it('returns the seeded mock categories', async () => {
      const categories = await mockApi.getCategories();
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('getLowStockItems', () => {
    it('summarizes low-stock raw materials', async () => {
      const summary = await mockApi.getLowStockItems();

      expect(summary.totalLowStock).toBe(summary.rawMaterials.length);
      expect(summary.rawMaterials.every(m => m.quantity <= m.minStock)).toBe(true);
    });
  });
});

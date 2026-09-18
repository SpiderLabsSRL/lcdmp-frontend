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
import { ProductsApi, MockProductsApi } from '../ProductsApi';
import type { CreateSweetTableComboData, EditSweetTableComboData } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('ProductsApi (real, axios-backed)', () => {
  let productsApi: ProductsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    productsApi = new ProductsApi();
  });

  describe('getSweetTableCombos', () => {
    it('returns the combo list on success', async () => {
      const combos = [{ id: '1', name: 'Combo 50' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: combos } });

      const result = await productsApi.getSweetTableCombos();

      expect(mockedApi.get).toHaveBeenCalledWith('/sweet-table-combos');
      expect(result).toEqual(combos);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error al obtener las mesas dulces' } });

      await expect(productsApi.getSweetTableCombos()).rejects.toThrow('Error al obtener las mesas dulces');
    });

    it('throws with a connection error when the request itself fails', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(productsApi.getSweetTableCombos()).rejects.toThrow('Network Error');
    });
  });

  describe('createSweetTableCombo', () => {
    it('posts to /sweet-table-combos and returns the created combo', async () => {
      const payload: CreateSweetTableComboData = {
        name: 'Combo 50',
        fixedPrice: 400,
        isActive: true,
        products: [{ productId: 'p1', quantity: 10, pricePerUnit: 5 }],
      };
      const created = { id: 'new-id', ...payload };
      mockedApi.post.mockResolvedValue({ data: { success: true, data: created } });

      const result = await productsApi.createSweetTableCombo(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/sweet-table-combos', payload);
      expect(result).toEqual(created);
    });
  });

  describe('editSweetTableCombo', () => {
    it('puts to /sweet-table-combos/:id without the id in the body', async () => {
      const payload: EditSweetTableComboData = { id: '1', name: 'Nuevo nombre' };
      mockedApi.put.mockResolvedValue({ data: { success: true, data: { id: '1', name: 'Nuevo nombre' } } });

      await productsApi.editSweetTableCombo(payload);

      expect(mockedApi.put).toHaveBeenCalledWith('/sweet-table-combos/1', { name: 'Nuevo nombre' });
    });
  });

  describe('toggleSweetTableComboStatus', () => {
    it('patches the toggle endpoint with the new isActive value', async () => {
      mockedApi.patch.mockResolvedValue({ data: { success: true, data: { id: '1', isActive: false } } });

      const result = await productsApi.toggleSweetTableComboStatus('1', false);

      expect(mockedApi.patch).toHaveBeenCalledWith('/sweet-table-combos/1/toggle', { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteSweetTableCombo', () => {
    it('deletes the combo', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: true } });

      await productsApi.deleteSweetTableCombo('1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/sweet-table-combos/1');
    });

    it('throws when the backend responds with success: false', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: false, message: 'No se pudo eliminar' } });

      await expect(productsApi.deleteSweetTableCombo('1')).rejects.toThrow('No se pudo eliminar');
    });
  });
});

describe('MockProductsApi (in-memory, combos)', () => {
  let mockApi: MockProductsApi;

  beforeEach(() => {
    mockApi = new MockProductsApi();
  });

  it('creates a combo, deriving totalQuantity from the sum of product quantities', async () => {
    const created = await mockApi.createSweetTableCombo({
      name: 'Combo nuevo',
      fixedPrice: 300,
      isActive: true,
      products: [
        { productId: '1', quantity: 5, pricePerUnit: 10 },
        { productId: '2', quantity: 7, pricePerUnit: 6 },
      ],
    });

    expect(created.totalQuantity).toBe(12);
    expect(created.isPreset).toBe(true);

    const all = await mockApi.getSweetTableCombos();
    expect(all).toContainEqual(created);
  });

  it('edits an existing combo and recomputes totalQuantity when products change', async () => {
    const created = await mockApi.createSweetTableCombo({
      name: 'Combo editable',
      fixedPrice: 100,
      isActive: true,
      products: [{ productId: '1', quantity: 2, pricePerUnit: 10 }],
    });

    const edited = await mockApi.editSweetTableCombo({
      id: created.id,
      products: [{ productId: '1', quantity: 9, pricePerUnit: 10 }],
    });

    expect(edited.totalQuantity).toBe(9);
    expect(edited.name).toBe('Combo editable');
  });

  it('throws when editing a combo that does not exist', async () => {
    await expect(mockApi.editSweetTableCombo({ id: 'missing', name: 'x' })).rejects.toThrow('Combo not found');
  });

  it('toggles isActive without touching other fields', async () => {
    const created = await mockApi.createSweetTableCombo({
      name: 'Combo toggle',
      fixedPrice: 100,
      isActive: true,
      products: [{ productId: '1', quantity: 1, pricePerUnit: 10 }],
    });

    const toggled = await mockApi.toggleSweetTableComboStatus(created.id, false);

    expect(toggled.isActive).toBe(false);
    expect(toggled.name).toBe('Combo toggle');
  });

  it('deletes a combo', async () => {
    const created = await mockApi.createSweetTableCombo({
      name: 'Combo a borrar',
      fixedPrice: 50,
      isActive: true,
      products: [{ productId: '1', quantity: 1, pricePerUnit: 5 }],
    });

    await mockApi.deleteSweetTableCombo(created.id);

    const all = await mockApi.getSweetTableCombos();
    expect(all.find(c => c.id === created.id)).toBeUndefined();
  });

  it('throws when deleting a combo that does not exist', async () => {
    await expect(mockApi.deleteSweetTableCombo('missing')).rejects.toThrow('Combo not found');
  });
});

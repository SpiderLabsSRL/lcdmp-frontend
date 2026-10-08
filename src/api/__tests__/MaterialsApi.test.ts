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
import { MaterialsApi } from '../MaterialsApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe('MaterialsApi', () => {
  let materialsApi: MaterialsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    materialsApi = new MaterialsApi();
  });

  it('getProductRecipe unwraps the recipe', async () => {
    const recipe = { baking: [{ rawMaterialId: 'm1', quantity: 0.05 }] };
    mockedApi.get.mockResolvedValue({ data: { success: true, data: recipe } });

    await expect(materialsApi.getProductRecipe('p1')).resolves.toEqual(recipe);
    expect(mockedApi.get).toHaveBeenCalledWith('/materials/recipes/product/p1');
  });

  it('saveProductRecipe sends only rawMaterialId and quantity per line', async () => {
    mockedApi.put.mockResolvedValue({ data: { success: true, data: {} } });

    await materialsApi.saveProductRecipe('p1', {
      baking: [{ rawMaterialId: 'm1', name: 'Harina', unit: 'kg', quantity: 2 }],
      assembling: [],
    });

    expect(mockedApi.put).toHaveBeenCalledWith('/materials/recipes/product/p1', {
      baking: [{ rawMaterialId: 'm1', quantity: 2 }],
      assembling: [],
    });
  });

  it('saveCakeRecipe puts to the cake endpoint', async () => {
    mockedApi.put.mockResolvedValue({ data: { success: true, data: {} } });

    await materialsApi.saveCakeRecipe({ baking: [] });

    expect(mockedApi.put).toHaveBeenCalledWith('/materials/recipes/cake', { baking: [] });
  });

  it('registerUsage posts the usage and resolves to nothing', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true, data: { id: 'mv1' } } });

    await expect(materialsApi.registerUsage({ orderId: 'o1', rawMaterialId: 'm1', quantity: 2 })).resolves.toBeUndefined();
    expect(mockedApi.post).toHaveBeenCalledWith('/materials/usage', { orderId: 'o1', rawMaterialId: 'm1', quantity: 2 });
  });

  it('getMovements passes the filters as query params', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

    await materialsApi.getMovements({ orderId: 'o1' });

    expect(mockedApi.get).toHaveBeenCalledWith('/materials/movements', { params: { orderId: 'o1' } });
  });

  it('surfaces the backend message on failure', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'Materia prima no encontrada' } } });

    await expect(materialsApi.registerUsage({ orderId: 'o1', rawMaterialId: 'x', quantity: 1 }))
      .rejects.toThrow('Materia prima no encontrada');
  });

  it('throws the backend message when success is false', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: false, message: 'nope' } });

    await expect(materialsApi.getCakeRecipe()).rejects.toThrow('nope');
  });
});

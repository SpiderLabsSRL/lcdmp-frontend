import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/api/api';
import { BakedApi } from '../BakedApi';

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', ReturnType<typeof vi.fn>>;
const ok = (data: unknown) => ({ data: { success: true, data } });

describe('BakedApi', () => {
  const bakedApi = new BakedApi();

  beforeEach(() => vi.clearAllMocks());

  it('gets the dough types, optionally including the inactive ones', async () => {
    mocked.get.mockResolvedValue(ok([]));

    await bakedApi.getDoughTypes();
    await bakedApi.getDoughTypes(true);

    expect(mocked.get).toHaveBeenNthCalledWith(1, '/baked/dough-types', { params: {} });
    expect(mocked.get).toHaveBeenNthCalledWith(2, '/baked/dough-types', { params: { includeInactive: true } });
  });

  it('sends only the filters that are set when listing items', async () => {
    mocked.get.mockResolvedValue(ok([]));

    await bakedApi.getItems({ search: 'choco', lowStock: true });

    expect(mocked.get).toHaveBeenCalledWith('/baked/items', { params: { search: 'choco', lowStock: 'true' } });
  });

  it('posts a batch, a waste and an adjustment to their endpoints', async () => {
    mocked.post.mockResolvedValue(ok({ id: 'i1' }));

    await bakedApi.addBatch({ doughTypeId: 'dt', flavor: 'Vainilla', quantity: 3 });
    await bakedApi.registerWaste('i1', { quantity: 1, wasteReason: 'burned' });
    await bakedApi.adjustStock('i1', { delta: -2, notes: 'conteo' });

    expect(mocked.post).toHaveBeenNthCalledWith(1, '/baked/batches', { doughTypeId: 'dt', flavor: 'Vainilla', quantity: 3 });
    expect(mocked.post).toHaveBeenNthCalledWith(2, '/baked/items/i1/waste', { quantity: 1, wasteReason: 'burned' });
    expect(mocked.post).toHaveBeenNthCalledWith(3, '/baked/items/i1/adjust', { delta: -2, notes: 'conteo' });
  });

  it('asks the backend what a line of an order will move', async () => {
    mocked.get.mockResolvedValue(ok([{ label: 'x', quantity: 2 }]));

    expect(await bakedApi.getLineEntries('custom_cake', 'c1')).toEqual([{ label: 'x', quantity: 2 }]);

    expect(mocked.get).toHaveBeenCalledWith('/baked/line-entries', { params: { itemType: 'custom_cake', itemId: 'c1' } });
  });

  it('throws the backend message when success is false, and a connection error otherwise', async () => {
    mocked.get.mockResolvedValueOnce({ data: { success: false, message: 'No se pudo' } });
    await expect(bakedApi.getItems()).rejects.toThrow('No se pudo');

    mocked.get.mockRejectedValueOnce({ response: { data: { message: 'Sin permiso' } } });
    await expect(bakedApi.getItems()).rejects.toThrow('Sin permiso');

    mocked.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(bakedApi.getItems()).rejects.toThrow('Network Error');
  });
});

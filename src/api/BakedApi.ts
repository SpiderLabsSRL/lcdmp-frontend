import api from '@/api/api';
import type { BakedItem, BakedMovement, CutResult, DoughType, LineEntry, WasteReason } from '@/types';

// Datos para crear un tipo de masa (los de corte solo aplican si isCuttable)
export interface NewDoughType {
  name: string;
  usesPortions: boolean;
  usesShape: boolean;
  // Por defecto true; false para masas sin sabor (pie...)
  usesFlavor?: boolean;
  isCuttable?: boolean;
  unitName?: string;
  defaultPortions?: number;
}

// Lo que identifica un ítem de masa: tipo + sabor + porciones (si el tipo las usa) + forma (si la usa).
export interface BakedItemSpec {
  doughTypeId: string;
  flavor: string;
  portions?: number | null;
  shape?: string | null;
}

export interface IBakedApi {
  getDoughTypes(includeInactive?: boolean): Promise<DoughType[]>;
  createDoughType(data: NewDoughType): Promise<DoughType>;
  updateDoughType(id: string, data: Partial<Pick<DoughType, 'name' | 'usesPortions' | 'usesShape' | 'usesFlavor' | 'isActive' | 'isCuttable' | 'unitName' | 'defaultPortions'>>): Promise<DoughType>;

  getItems(filters?: { doughTypeId?: string; search?: string; lowStock?: boolean }): Promise<BakedItem[]>;
  updateItemMinStock(id: string, minStock: number): Promise<BakedItem>;
  deleteItem(id: string): Promise<void>;
  getMovements(itemId: string): Promise<BakedMovement[]>;

  // Hornos: registrar una tanda horneada (entrada libre)
  addBatch(data: BakedItemSpec & { quantity: number; notes?: string }): Promise<BakedItem>;
  // Hornos: cortar unidades enteras (láminas / masas grandes) en piezas con porciones
  cutItem(id: string, data: { quantity: number; portions: number; pieces: number; notes?: string }): Promise<CutResult>;
  // Admin: merma y ajuste manual (delta > 0 entra, delta < 0 sale)
  registerWaste(id: string, data: { quantity: number; wasteReason: WasteReason; notes?: string }): Promise<BakedItem>;
  adjustStock(id: string, data: { delta: number; notes?: string }): Promise<BakedItem>;

  // Hornos: la masa que propone registrar al completar una línea de pedido
  getLineEntries(itemType: string, itemId: string): Promise<LineEntry[]>;
  // Admin: masa que genera/consume un producto de catálogo (null = quitar el vínculo)
  setProductLink(productId: string, link: BakedItemSpec | null): Promise<BakedItem | null>;
}

const fail = (error: any, fallback: string): never => {
  console.error(fallback, error);
  throw new Error(error.response?.data?.message || error.message || fallback);
};

async function call<T>(request: Promise<any>, fallback: string): Promise<T> {
  try {
    const response = await request;
    if (!response.data.success) throw new Error(response.data.message || fallback);
    return response.data.data as T;
  } catch (error) {
    return fail(error, fallback);
  }
}

export class BakedApi implements IBakedApi {
  getDoughTypes(includeInactive = false) {
    return call<DoughType[]>(api.get('/baked/dough-types', { params: includeInactive ? { includeInactive: true } : {} }), 'Error al obtener los tipos de masa');
  }

  createDoughType(data: NewDoughType) {
    return call<DoughType>(api.post('/baked/dough-types', data), 'Error al crear el tipo de masa');
  }

  updateDoughType(id: string, data: Partial<Pick<DoughType, 'name' | 'usesPortions' | 'usesShape' | 'usesFlavor' | 'isActive' | 'isCuttable' | 'unitName' | 'defaultPortions'>>) {
    return call<DoughType>(api.put(`/baked/dough-types/${id}`, data), 'Error al actualizar el tipo de masa');
  }

  getItems(filters: { doughTypeId?: string; search?: string; lowStock?: boolean } = {}) {
    const params: Record<string, string> = {};
    if (filters.doughTypeId) params.doughTypeId = filters.doughTypeId;
    if (filters.search) params.search = filters.search;
    if (filters.lowStock) params.lowStock = 'true';
    return call<BakedItem[]>(api.get('/baked/items', { params }), 'Error al obtener el inventario horneado');
  }

  updateItemMinStock(id: string, minStock: number) {
    return call<BakedItem>(api.put(`/baked/items/${id}`, { minStock }), 'Error al actualizar el stock mínimo');
  }

  async deleteItem(id: string) {
    await call<null>(api.delete(`/baked/items/${id}`), 'Error al eliminar el ítem');
  }

  getMovements(itemId: string) {
    return call<BakedMovement[]>(api.get(`/baked/items/${itemId}/movements`), 'Error al obtener el historial');
  }

  addBatch(data: BakedItemSpec & { quantity: number; notes?: string }) {
    return call<BakedItem>(api.post('/baked/batches', data), 'Error al registrar el horneado');
  }

  cutItem(id: string, data: { quantity: number; portions: number; pieces: number; notes?: string }) {
    return call<CutResult>(api.post(`/baked/items/${id}/cut`, data), 'Error al registrar el corte');
  }

  registerWaste(id: string, data: { quantity: number; wasteReason: WasteReason; notes?: string }) {
    return call<BakedItem>(api.post(`/baked/items/${id}/waste`, data), 'Error al registrar la merma');
  }

  adjustStock(id: string, data: { delta: number; notes?: string }) {
    return call<BakedItem>(api.post(`/baked/items/${id}/adjust`, data), 'Error al ajustar el stock');
  }

  getLineEntries(itemType: string, itemId: string) {
    return call<LineEntry[]>(api.get('/baked/line-entries', { params: { itemType, itemId } }), 'Error al obtener las masas de la línea');
  }

  setProductLink(productId: string, link: BakedItemSpec | null) {
    return call<BakedItem | null>(api.put(`/baked/products/${productId}/link`, { link }), 'Error al vincular la masa del producto');
  }
}

export const defaultBakedApi = new BakedApi();

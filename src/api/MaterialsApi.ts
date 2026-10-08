import api from '@/api/api';

// Receta: etapa -> materiales. Las cantidades van siempre en la unidad de la
// materia prima. Receta de producto = por unidad; receta de torta = por cada 10 porciones.
export interface RecipeLine {
  rawMaterialId: string;
  name?: string;
  unit?: string;
  quantity: number;
}

export type Recipe = Record<string, RecipeLine[]>;

export interface MaterialMovement {
  id: string;
  rawMaterialId: string | null;
  materialName: string;
  unit: string | null;
  quantity: number;
  orderId: string | null;
  orderNumber: string | null;
  itemType: string | null;
  itemId: string | null;
  stage: 'baking' | 'assembling' | 'decorating' | 'restock';
  source: 'recipe' | 'manual';
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface RegisterUsageData {
  orderId: string;
  rawMaterialId: string;
  quantity: number;
  notes?: string;
}

export interface IMaterialsApi {
  getProductRecipe(productId: string): Promise<Recipe>;
  saveProductRecipe(productId: string, recipe: Recipe): Promise<Recipe>;
  getCakeRecipe(): Promise<Recipe>;
  saveCakeRecipe(recipe: Recipe): Promise<Recipe>;
  registerUsage(data: RegisterUsageData): Promise<void>;
  getMovements(filters?: { orderId?: string; rawMaterialId?: string; limit?: number }): Promise<MaterialMovement[]>;
}

const fail = (label: string, error: any): never => {
  console.error(`Error en ${label}:`, error);
  throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
};

const unwrap = <T>(response: any, fallback: string): T => {
  if (!response.data.success) throw new Error(response.data.message || fallback);
  return response.data.data as T;
};

// Solo se envía rawMaterialId y quantity; name/unit son de lectura.
const toPayload = (recipe: Recipe): Recipe =>
  Object.fromEntries(
    Object.entries(recipe).map(([stage, lines]) => [
      stage,
      lines.map(({ rawMaterialId, quantity }) => ({ rawMaterialId, quantity })),
    ])
  );

export class MaterialsApi implements IMaterialsApi {
  async getProductRecipe(productId: string): Promise<Recipe> {
    try {
      return unwrap(await api.get(`/materials/recipes/product/${productId}`), 'Error al obtener la receta');
    } catch (error: any) {
      return fail('getProductRecipe', error);
    }
  }

  async saveProductRecipe(productId: string, recipe: Recipe): Promise<Recipe> {
    try {
      return unwrap(await api.put(`/materials/recipes/product/${productId}`, toPayload(recipe)), 'Error al guardar la receta');
    } catch (error: any) {
      return fail('saveProductRecipe', error);
    }
  }

  async getCakeRecipe(): Promise<Recipe> {
    try {
      return unwrap(await api.get('/materials/recipes/cake'), 'Error al obtener la receta de tortas');
    } catch (error: any) {
      return fail('getCakeRecipe', error);
    }
  }

  async saveCakeRecipe(recipe: Recipe): Promise<Recipe> {
    try {
      return unwrap(await api.put('/materials/recipes/cake', toPayload(recipe)), 'Error al guardar la receta de tortas');
    } catch (error: any) {
      return fail('saveCakeRecipe', error);
    }
  }

  async registerUsage(data: RegisterUsageData): Promise<void> {
    try {
      unwrap(await api.post('/materials/usage', data), 'Error al registrar el material');
    } catch (error: any) {
      fail('registerUsage', error);
    }
  }

  async getMovements(filters: { orderId?: string; rawMaterialId?: string; limit?: number } = {}): Promise<MaterialMovement[]> {
    try {
      return unwrap(await api.get('/materials/movements', { params: filters }), 'Error al obtener los movimientos');
    } catch (error: any) {
      return fail('getMovements', error);
    }
  }
}

export const defaultMaterialsApi = new MaterialsApi();

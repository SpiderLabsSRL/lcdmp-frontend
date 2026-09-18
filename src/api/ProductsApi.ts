import { Product, Flavor, CreateProductData, EditProductData, AddStockData, CreateFlavorData, EditFlavorData, SweetTableCombo, CreateSweetTableComboData, EditSweetTableComboData } from '@/types';
import api from '@/api/api';
import { mockProducts, mockFlavors, mockCombos } from '@/data/mockData';

export interface IProductsApi {
  getProducts(searchTerm?: string): Promise<Product[]>;
  createProduct(product: CreateProductData): Promise<Product>;
  editProduct(product: EditProductData): Promise<Product>;
  deleteProduct(productId: string): Promise<void>;
  addProductStock(data: AddStockData): Promise<Product>;

  getFlavors(): Promise<Flavor[]>;
  createFlavor(flavor: CreateFlavorData): Promise<Flavor>;
  editFlavor(flavor: EditFlavorData): Promise<Flavor>;
  toggleFlavorStatus(flavorId: string, isActive: boolean): Promise<Flavor>;
  deleteFlavor(flavorId: string): Promise<void>;

  getSweetTableCombos(): Promise<SweetTableCombo[]>;
  createSweetTableCombo(combo: CreateSweetTableComboData): Promise<SweetTableCombo>;
  editSweetTableCombo(combo: EditSweetTableComboData): Promise<SweetTableCombo>;
  toggleSweetTableComboStatus(comboId: string, isActive: boolean): Promise<SweetTableCombo>;
  deleteSweetTableCombo(comboId: string): Promise<void>;
}

export class MockProductsApi implements IProductsApi {
  private products: Product[] = [...mockProducts];
  private flavors: Flavor[] = [...mockFlavors];
  private combos: SweetTableCombo[] = [...mockCombos];

  async getProducts(searchTerm: string = ''): Promise<Product[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    let filtered = [...this.products];
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }

  async createProduct(productData: CreateProductData): Promise<Product> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      portionSize: 10, // Default value
    };
    
    this.products.push(newProduct);
    return newProduct;
  }

  async editProduct(productData: EditProductData): Promise<Product> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.products.findIndex(p => p.id === productData.id);
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    const updatedProduct = {
      ...this.products[index],
      ...productData,
      id: productData.id,
    };
    
    this.products[index] = updatedProduct;
    return updatedProduct;
  }

  async deleteProduct(productId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.products.findIndex(p => p.id === productId);
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    this.products.splice(index, 1);
  }

  async addProductStock(data: AddStockData): Promise<Product> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.products.findIndex(p => p.id === data.productId);
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    const updatedProduct = {
      ...this.products[index],
      stock: this.products[index].stock + data.quantity,
    };
    
    this.products[index] = updatedProduct;
    return updatedProduct;
  }

  async getFlavors(): Promise<Flavor[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return [...this.flavors];
  }

  async createFlavor(flavorData: CreateFlavorData): Promise<Flavor> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newFlavor: Flavor = {
      ...flavorData,
      id: Date.now().toString(),
    };
    
    this.flavors.push(newFlavor);
    return newFlavor;
  }

  async editFlavor(flavorData: EditFlavorData): Promise<Flavor> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.flavors.findIndex(f => f.id === flavorData.id);
    if (index === -1) {
      throw new Error('Flavor not found');
    }
    
    const updatedFlavor = {
      ...this.flavors[index],
      ...flavorData,
      id: flavorData.id,
    };
    
    this.flavors[index] = updatedFlavor;
    return updatedFlavor;
  }

  async toggleFlavorStatus(flavorId: string, isActive: boolean): Promise<Flavor> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const index = this.flavors.findIndex(f => f.id === flavorId);
    if (index === -1) {
      throw new Error('Flavor not found');
    }
    
    const updatedFlavor = {
      ...this.flavors[index],
      isActive,
    };
    
    this.flavors[index] = updatedFlavor;
    return updatedFlavor;
  }

  async deleteFlavor(flavorId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = this.flavors.findIndex(f => f.id === flavorId);
    if (index === -1) {
      throw new Error('Flavor not found');
    }

    this.flavors.splice(index, 1);
  }

  async getSweetTableCombos(): Promise<SweetTableCombo[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return [...this.combos];
  }

  async createSweetTableCombo(comboData: CreateSweetTableComboData): Promise<SweetTableCombo> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const totalQuantity = comboData.products.reduce((sum, p) => sum + p.quantity, 0);
    const newCombo: SweetTableCombo = {
      id: Date.now().toString(),
      name: comboData.name,
      totalQuantity,
      fixedPrice: comboData.fixedPrice,
      price: comboData.fixedPrice,
      isActive: comboData.isActive,
      isPreset: true,
      products: comboData.products.map(p => ({
        ...p,
        product: this.products.find(prod => prod.id === p.productId),
        productName: this.products.find(prod => prod.id === p.productId)?.name,
      })),
    };

    this.combos.push(newCombo);
    return newCombo;
  }

  async editSweetTableCombo(comboData: EditSweetTableComboData): Promise<SweetTableCombo> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = this.combos.findIndex(c => c.id === comboData.id);
    if (index === -1) {
      throw new Error('Combo not found');
    }

    const current = this.combos[index];
    const products = comboData.products
      ? comboData.products.map(p => ({
          ...p,
          product: this.products.find(prod => prod.id === p.productId),
          productName: this.products.find(prod => prod.id === p.productId)?.name,
        }))
      : current.products;
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const fixedPrice = comboData.fixedPrice ?? current.fixedPrice;

    const updatedCombo: SweetTableCombo = {
      ...current,
      name: comboData.name ?? current.name,
      isActive: comboData.isActive ?? current.isActive,
      fixedPrice,
      price: fixedPrice,
      products,
      totalQuantity,
    };

    this.combos[index] = updatedCombo;
    return updatedCombo;
  }

  async toggleSweetTableComboStatus(comboId: string, isActive: boolean): Promise<SweetTableCombo> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = this.combos.findIndex(c => c.id === comboId);
    if (index === -1) {
      throw new Error('Combo not found');
    }

    const updatedCombo = { ...this.combos[index], isActive };
    this.combos[index] = updatedCombo;
    return updatedCombo;
  }

  async deleteSweetTableCombo(comboId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = this.combos.findIndex(c => c.id === comboId);
    if (index === -1) {
      throw new Error('Combo not found');
    }

    this.combos.splice(index, 1);
  }
}

export class ProductsApi implements IProductsApi {
  async getProducts(searchTerm: string = ''): Promise<Product[]> {
    try {
      const response = await api.get('/products', {
        params: { search: searchTerm || undefined }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener productos');
      }

      return response.data.data as Product[];
    } catch (error: any) {
      console.error('Error en getProducts:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async createProduct(product: CreateProductData): Promise<Product> {
    try {
      const response = await api.post('/products', product);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al crear producto');
      }

      return response.data.data as Product;
    } catch (error: any) {
      console.error('Error en createProduct:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async editProduct(product: EditProductData): Promise<Product> {
    try {
      const { id, ...updateData } = product;
      const response = await api.put(`/products/${id}`, updateData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al editar producto');
      }

      return response.data.data as Product;
    } catch (error: any) {
      console.error('Error en editProduct:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const response = await api.delete(`/products/${productId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al eliminar producto');
      }
    } catch (error: any) {
      console.error('Error en deleteProduct:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async addProductStock(data: AddStockData): Promise<Product> {
    try {
      const response = await api.post(`/products/${data.productId}/stock`, {
        quantity: data.quantity
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al agregar stock');
      }

      return response.data.data as Product;
    } catch (error: any) {
      console.error('Error en addProductStock:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getFlavors(): Promise<Flavor[]> {
    try {
      const response = await api.get('/products/flavors');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener sabores');
      }

      return response.data.data as Flavor[];
    } catch (error: any) {
      console.error('Error en getFlavors:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async createFlavor(flavor: CreateFlavorData): Promise<Flavor> {
    try {
      const response = await api.post('/products/flavors', flavor);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al crear sabor');
      }

      return response.data.data as Flavor;
    } catch (error: any) {
      console.error('Error en createFlavor:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async editFlavor(flavor: EditFlavorData): Promise<Flavor> {
    try {
      const { id, ...updateData } = flavor;
      const response = await api.put(`/products/flavors/${id}`, updateData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al editar sabor');
      }

      return response.data.data as Flavor;
    } catch (error: any) {
      console.error('Error en editFlavor:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async toggleFlavorStatus(flavorId: string, isActive: boolean): Promise<Flavor> {
    try {
      const response = await api.patch(`/products/flavors/${flavorId}/toggle`, {
        isActive
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al cambiar estado del sabor');
      }

      return response.data.data as Flavor;
    } catch (error: any) {
      console.error('Error en toggleFlavorStatus:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async deleteFlavor(flavorId: string): Promise<void> {
    try {
      const response = await api.delete(`/products/flavors/${flavorId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al eliminar sabor');
      }
    } catch (error: any) {
      console.error('Error en deleteFlavor:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getSweetTableCombos(): Promise<SweetTableCombo[]> {
    try {
      const response = await api.get('/sweet-table-combos');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener las mesas dulces');
      }

      return response.data.data as SweetTableCombo[];
    } catch (error: any) {
      console.error('Error en getSweetTableCombos:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async createSweetTableCombo(combo: CreateSweetTableComboData): Promise<SweetTableCombo> {
    try {
      const response = await api.post('/sweet-table-combos', combo);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al crear la mesa dulce');
      }

      return response.data.data as SweetTableCombo;
    } catch (error: any) {
      console.error('Error en createSweetTableCombo:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async editSweetTableCombo(combo: EditSweetTableComboData): Promise<SweetTableCombo> {
    try {
      const { id, ...updateData } = combo;
      const response = await api.put(`/sweet-table-combos/${id}`, updateData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al editar la mesa dulce');
      }

      return response.data.data as SweetTableCombo;
    } catch (error: any) {
      console.error('Error en editSweetTableCombo:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async toggleSweetTableComboStatus(comboId: string, isActive: boolean): Promise<SweetTableCombo> {
    try {
      const response = await api.patch(`/sweet-table-combos/${comboId}/toggle`, { isActive });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al cambiar el estado de la mesa dulce');
      }

      return response.data.data as SweetTableCombo;
    } catch (error: any) {
      console.error('Error en toggleSweetTableComboStatus:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async deleteSweetTableCombo(comboId: string): Promise<void> {
    try {
      const response = await api.delete(`/sweet-table-combos/${comboId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al eliminar la mesa dulce');
      }
    } catch (error: any) {
      console.error('Error en deleteSweetTableCombo:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }
}

export const defaultProductsApi = new ProductsApi();
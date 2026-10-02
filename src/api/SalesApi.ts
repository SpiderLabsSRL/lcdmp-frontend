import { Product } from '@/types';
import api from '@/api/api';
import { mockProducts } from '@/data/mockData';

export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface SaleData {
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'qr';
  timestamp: Date;
}

export interface ISalesApi {
  getProducts(searchTerm?: string): Promise<Product[]>;
  createSale(sale: SaleData): Promise<void>;
}

export class MockSalesApi implements ISalesApi {
  private products: Product[] = mockProducts

   async getProducts(searchTerm: string = ''): Promise<Product[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    // Caja solo vende lo que hay en TIENDA — lo que sigue en planta no está disponible.
    let filtered = this.products.filter(p => p.isActive && p.storeStock > 0);
    
    if (searchTerm.trim()) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }

  async createSale(sale: SaleData): Promise<void> {
    console.log('Mock sale created:', sale);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

export class SalesApi implements ISalesApi {
  async getProducts(searchTerm: string = ''): Promise<Product[]> {
    try {
      const response = await api.get('/sales/products', {
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

  async createSale(sale: SaleData): Promise<void> {
    try {
      const payload = {
        items: sale.items,
        total: sale.total,
        paymentMethod: sale.paymentMethod
      };

      const response = await api.post('/sales', payload);

      if (!response.data.success && response.status !== 201) {
        throw new Error(response.data.message || 'Error al crear la venta');
      }
    } catch (error: any) {
      console.error('Error en createSale:', error);
      const message = error.response?.data?.message || error.message || 'Error al procesar la venta';
      throw new Error(message);
    }
  }
}

export const defaultSalesApi = new SalesApi();
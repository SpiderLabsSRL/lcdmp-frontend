import { Product } from '@/types';
import api from '@/api/api';
import { mockProducts } from '@/data/mockData';
import type { SalePayment } from '@/utils/payments';
import type { PaymentMethod, PickupMethod } from '@/types';

export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface SaleData {
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'qr' | 'both';
  payments?: SalePayment[];
  timestamp: Date;
  // Confirma que la venta pise unidades reservadas por pedidos de hoy.
  overrideReservation?: boolean;
}

export interface ReservationConflict {
  productId: string;
  lines: {
    id: string;
    orderId: string;
    quantity: number;
    orderNumber: string;
    pickupDate: string;
    pickupTime: string | null;
  }[];
}

// La venta se llevaría stock reservado: hay que confirmar antes de seguir.
export class ReservationConflictError extends Error {
  conflicts: ReservationConflict[];

  constructor(message: string, conflicts: ReservationConflict[]) {
    super(message);
    this.name = 'ReservationConflictError';
    this.conflicts = conflicts;
  }
}

// Pedido de envío al momento: productos disponibles ahora que recoge alguien enseguida
export interface ExpressOrderData {
  recipientName: string;
  pickupMethod: PickupMethod;
  customerPhone?: string;
  items: {
    productId: string;
    quantity: number;
    customizationNotes?: string;
    customizationPrice?: number;
  }[];
  // true: reserva stock de tienda y se descuenta al entregar. false: no toca el stock.
  deductStock: boolean;
  // > 0 = el cliente paga el envío (se suma al total)
  shippingCost?: number;
  // Lo pagado al registrar (puede ser parte del total); el resto se cobra al entregar
  deposit: number;
  paymentMethod: PaymentMethod;
  dedication?: string;
  notes?: string;
}

export interface ExpressOrderResult {
  id: string;
  orderNumber: string;
  total: number;
}

export interface ISalesApi {
  getProducts(searchTerm?: string): Promise<Product[]>;
  createSale(sale: SaleData): Promise<void>;
  createExpressOrder(order: ExpressOrderData): Promise<ExpressOrderResult>;
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

  async createExpressOrder(order: ExpressOrderData): Promise<ExpressOrderResult> {
    console.log('Mock express order created:', order);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id: 'mock-express', orderNumber: 'ORD-MOCK-EXPRESS', total: order.deposit };
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
        paymentMethod: sale.paymentMethod,
        payments: sale.payments,
        overrideReservation: sale.overrideReservation === true
      };

      const response = await api.post('/sales', payload);

      if (!response.data.success && response.status !== 201) {
        throw new Error(response.data.message || 'Error al crear la venta');
      }
    } catch (error: any) {
      console.error('Error en createSale:', error);
      if (error.response?.data?.code === 'RESERVATION_CONFLICT') {
        throw new ReservationConflictError(error.response.data.message, error.response.data.conflicts);
      }
      const message = error.response?.data?.message || error.message || 'Error al procesar la venta';
      throw new Error(message);
    }
  }

  async createExpressOrder(order: ExpressOrderData): Promise<ExpressOrderResult> {
    try {
      const response = await api.post('/orders/express', order);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }

      const { id, orderNumber, total } = response.data.data;
      return { id, orderNumber, total };
    } catch (error: any) {
      console.error('Error en createExpressOrder:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al crear el pedido de envío al momento');
    }
  }
}

export const defaultSalesApi = new SalesApi();
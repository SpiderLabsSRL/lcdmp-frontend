import api from '@/api/api';
import { mockOrders, mockBakedProducts } from '@/data/mockData';
import type { Order, OrderStatus, CustomCake, BakedProduct } from '@/types';

export interface IBakingApi {
  getBakingOrders(signal?: AbortSignal): Promise<Order[]>;
  getBakedProductsStock(): Promise<BakedProduct[]>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  completeBaking(orderId: string, bakedQuantities: Map<string, number>): Promise<void>;
}

export class MockBakingApi implements IBakingApi {
  private orders: Order[] = [];
  private bakedProducts: BakedProduct[] = [];

  constructor() {
    this.orders = [...mockOrders];
    this.bakedProducts = [...mockBakedProducts];
  }

  async getBakingOrders(signal?: AbortSignal): Promise<Order[]> {
    await this.simulateNetworkDelay();
    
    return this.orders
      .filter(o => o.status === 'pending' || o.status === 'baking')
      .sort((a, b) => {
        const hoursA = this.getHoursUntilPickup(a.pickupDate);
        const hoursB = this.getHoursUntilPickup(b.pickupDate);
        const portionsA = this.getTotalPortions(a.customCakes);
        const portionsB = this.getTotalPortions(b.customCakes);
        return (hoursA - portionsA / 10) - (hoursB - portionsB / 10);
      });
  }

  async getBakedProductsStock(): Promise<BakedProduct[]> {
    await this.simulateNetworkDelay();
    return this.bakedProducts.filter(p => p.type === 'cake_base');
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }
    
    this.orders[index] = { ...this.orders[index], status };
    console.log(`Order ${id} status updated to ${status}`);
    
    return this.orders[index];
  }

  async completeBaking(orderId: string, bakedQuantities: Map<string, number>): Promise<void> {
    await this.simulateNetworkDelay();
    
    // Update order status
    await this.updateOrderStatus(orderId, 'assembling');
    
    // Update baked products stock
    bakedQuantities.forEach((quantity, cakeFlavor) => {
      const product = this.bakedProducts.find(p => p.name.includes(cakeFlavor));
      if (product) {
        product.quantity += quantity;
      }
    });
    
    console.log(`Baking completed for order ${orderId}`);
  }

  private async simulateNetworkDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private getHoursUntilPickup(pickupDate: Date): number {
    const diffInHours = (pickupDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return Math.max(0, diffInHours);
  }

  private getTotalPortions(customCakes: CustomCake[]): number {
    return customCakes.reduce((sum, cake) => sum + (cake.portions * (cake.quantity || 1)), 0);
  }
}

export class BakingApi implements IBakingApi {
  async getBakingOrders(signal?: AbortSignal): Promise<Order[]> {
    try {
      const params: any = {};
      params.status = 'baking';
			params.limit = 50;
      
      const response = await api.get('/orders', { 
        params,
        signal
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener pedidos');
      }
      
      const orders = response.data.data.map((order: any) => {
        const [year, month, day] = order.pickupDate.split('-');

        return {
          ...order,
          pickupDate: new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
          ),
          createdAt: new Date(order.createdAt)
        };
      });
      
      return orders;
    } catch (error: any) {
      console.error('Error en getBakingOrders:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getBakedProductsStock(): Promise<BakedProduct[]> {
    try {
      const response = await api.get('/inventory/baked-products');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener stock de productos horneados');
      }
      
      return response.data.data.map((product: any) => ({
        ...product,
        lastUpdated: new Date(product.lastUpdated),
        expiresAt: product.expiresAt ? new Date(product.expiresAt) : undefined,
        createdAt: new Date(product.createdAt)
      }));
    } catch (error: any) {
      console.error('Error en getBakedProductsStock:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${id}/status`, { status });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al actualizar el estado del pedido');
      }
      
      return {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
    } catch (error: any) {
      console.error('Error en updateOrderStatus:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al actualizar el estado');
    }
  }

  async completeBaking(orderId: string, bakedQuantities: Map<string, number>): Promise<void> {
    try {
      const payload = {
        orderId,
        bakedProducts: Array.from(bakedQuantities.entries()).map(([productName, quantity]) => ({
          productName,
          quantity
        }))
      };
      //const response = await api.post('/baking/complete', payload);
      
      const response = await api.patch(`/orders/${orderId}/status`, { status: 'assembling' });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al actualizar el estado');
      }
      
      const order = {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
      
      return order;
    } catch (error: any) {
      console.error('Error en completeBaking:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al completar el horneado');
    }
  }
}

export const defaultBakingApi = new BakingApi();
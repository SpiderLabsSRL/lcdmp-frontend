import api from '@/api/api';
import { mockOrders, mockBakedProducts } from '@/data/mockData';
import type { Order, OrderStatus, CustomCake, BakedProduct } from '@/types';

export interface IAssemblyApi {
  getAssemblyOrders(): Promise<Order[]>;
  //getAvailableBases(): Promise<BakedProduct[]>;
  //checkMaterialAvailability(orderId: string): Promise<boolean>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  completeAssembly(orderId: string, assembledCakes: Map<string, boolean>): Promise<void>;
}

export class MockAssemblyApi implements IAssemblyApi {
  private orders: Order[] = [];
  private bakedProducts: BakedProduct[] = [];

  constructor() {
    this.orders = [...mockOrders];
    this.bakedProducts = [...mockBakedProducts];
  }

  async getAssemblyOrders(): Promise<Order[]> {
    await this.simulateNetworkDelay();
    
    return this.orders
      .filter(o => o.status === 'assembling')
      .sort((a, b) => {
        const hoursA = this.getHoursUntilPickup(a.pickupDate);
        const hoursB = this.getHoursUntilPickup(b.pickupDate);
        const portionsA = this.getTotalPortions(a.customCakes);
        const portionsB = this.getTotalPortions(b.customCakes);
        return (hoursA - portionsA / 10) - (hoursB - portionsB / 10);
      });
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

  async completeAssembly(orderId: string, assembledCakes: Map<string, boolean>): Promise<void> {
    await this.simulateNetworkDelay();
    
    // Update order status to decorating
    await this.updateOrderStatus(orderId, 'decorating');
    
    // Deduct used bases from inventory
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      const basesNeeded = this.getTotalBasesNeeded(order.customCakes);
      let remainingToDeduct = basesNeeded;
      
      for (const product of this.bakedProducts) {
        if (product.type === 'cake_base' && remainingToDeduct > 0) {
          const deduction = Math.min(product.quantity, remainingToDeduct);
          product.quantity -= deduction;
          remainingToDeduct -= deduction;
          
          if (remainingToDeduct === 0) break;
        }
      }
    }
    
    console.log(`Assembly completed for order ${orderId}`);
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

  private getTotalBasesNeeded(customCakes: CustomCake[]): number {
    return customCakes.reduce((sum, cake) => sum + (cake.quantity || 1), 0);
  }
}

export class AssemblyApi implements IAssemblyApi {
  async getAssemblyOrders(signal?: AbortSignal): Promise<Order[]> {
    try {
      const params: any = {};
      params.status = 'assembling';
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
      console.error('Error en getAssemblyOrders:', error);
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

  async completeAssembly(orderId: string, assembledCakes: Map<string, boolean>): Promise<void> {
    try {
      const payload = {
        orderId,
        assembledCakes: Array.from(assembledCakes.entries()).map(([cakeId, assembled]) => ({
          cakeId,
          assembled
        }))
      };
      
      //const response = await api.post('/assembly/complete', payload);
      
      const response = await api.patch(`/orders/${orderId}/status`, { status: 'decorating' });
      
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
      console.error('Error en completeAssembly:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al completar el armado');
    }
  }
}

// Default instance for development
export const defaultAssemblyApi = new AssemblyApi();
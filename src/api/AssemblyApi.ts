import api from '@/api/api';
import { mockOrders, mockBakedProducts } from '@/data/mockData';
import { getWorkItemsAtStage } from '@/utils/workItems';
import type { Order, OrderStatus, CustomCake, BakedProduct, WorkItemType } from '@/types';

export interface IAssemblyApi {
  getAssemblyOrders(signal?: AbortSignal): Promise<Order[]>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order>;
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
      .filter(o => getWorkItemsAtStage([o], 'assembling').length > 0)
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

  async completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order> {
    await this.simulateNetworkDelay();

    const index = this.orders.findIndex(o => o.id === orderId);
    if (index === -1) {
      throw new Error(`Order with id ${orderId} not found`);
    }

    console.log('Mock completeItem (assembling -> decorating):', { orderId, itemType, itemId });
    return this.orders[index];
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
      params.itemStage = 'assembling';
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

  async completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${orderId}/items/${itemType}/${itemId}/advance`, { toStage: 'decorating' });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al actualizar la etapa');
      }

      return {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
    } catch (error: any) {
      console.error('Error en completeItem:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al completar el armado');
    }
  }
}

// Default instance for development
export const defaultAssemblyApi = new AssemblyApi();
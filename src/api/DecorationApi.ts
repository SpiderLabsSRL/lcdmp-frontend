// src/api/DecorationApi.ts
import api from '@/api/api';
import { getWorkItemsAtStage } from '@/utils/workItems';
import type { Order, WorkItemType } from '@/types';

export interface IDecorationApi {
  getDecorationOrders(signal?: AbortSignal): Promise<Order[]>;
  completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order>;
  getOrderDetails(orderId: string): Promise<Order>;
}

export class MockDecorationApi implements IDecorationApi {
  private orders: Order[] = [];

  async getDecorationOrders(signal?: AbortSignal): Promise<Order[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Filtrar órdenes que necesitan decoración
    const decorationOrders = this.orders.filter(o => getWorkItemsAtStage([o], 'decorating').length > 0);
    
    // Ordenar por urgencia (fecha de entrega más cercana)
    return decorationOrders.sort((a, b) => 
      new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()
    );
  }

  async completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const order = this.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');

    console.log('Mock completeItem (decorating -> ready):', { orderId, itemType, itemId });
    return order;
  }

  async getOrderDetails(orderId: string): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const order = this.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    
    return order;
  }

  // Método auxiliar para mock (en producción no debería estar)
  setMockOrders(orders: Order[]): void {
    this.orders = orders;
  }
}

export class DecorationApi implements IDecorationApi {
  async getDecorationOrders(signal?: AbortSignal): Promise<Order[]> {
    try {
      const params: any = {};
      params.itemStage = 'decorating';
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
      console.error('Error en getDecorationOrders:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async completeItem(orderId: string, itemType: WorkItemType, itemId: string): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${orderId}/items/${itemType}/${itemId}/advance`, { toStage: 'ready' });

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
      throw new Error(error.response?.data?.message || error.message || 'Error al completar la decoración');
    }
  }

  async getOrderDetails(orderId: string): Promise<Order> {
    try {
      const response = await api.get(`/orders/${orderId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener detalles del pedido');
      }
      
      return response.data.data as Order;
    } catch (error: any) {
      console.error('Error en getOrderDetails:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }
}

export const defaultDecorationApi = new DecorationApi();
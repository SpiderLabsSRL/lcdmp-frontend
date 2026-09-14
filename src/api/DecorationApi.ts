// src/api/DecorationApi.ts
import api from '@/api/api';
import type { Order } from '@/types';

export interface IDecorationApi {
  getDecorationOrders(signal?: AbortSignal): Promise<Order[]>;
  completeDecoration(orderId: string, notes?: string): Promise<void>;
  getOrderDetails(orderId: string): Promise<Order>;
}

export class MockDecorationApi implements IDecorationApi {
  private orders: Order[] = [];

  async getDecorationOrders(signal?: AbortSignal): Promise<Order[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Filtrar órdenes que necesitan decoración
    const decorationOrders = this.orders.filter(o => o.status === 'decorating');
    
    // Ordenar por urgencia (fecha de entrega más cercana)
    return decorationOrders.sort((a, b) => 
      new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()
    );
  }

  async completeDecoration(orderId: string, notes?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const order = this.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    
    order.status = 'ready';
    console.log('Mock decoration completed:', orderId, notes);
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
      params.status = 'decorating';
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

  async completeDecoration(orderId: string, notes?: string): Promise<void> {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: 'ready' });
      
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
      console.error('Error en completeDecoration:', error);
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
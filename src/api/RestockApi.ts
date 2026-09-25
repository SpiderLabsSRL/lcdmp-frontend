import api from '@/api/api';
import type { Order } from '@/types';

export interface IRestockApi {
  getRestockOrders(signal?: AbortSignal): Promise<Order[]>;
  confirmRestock(orderId: string, itemId: string, actualQuantity: number): Promise<Order>;
}

export class MockRestockApi implements IRestockApi {
  private orders: Order[] = [];

  async getRestockOrders(signal?: AbortSignal): Promise<Order[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.orders.filter(o => o.orderType === 'restock' && o.status === 'ready');
  }

  async confirmRestock(orderId: string, itemId: string, actualQuantity: number): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const order = this.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    console.log('Mock confirmRestock:', { orderId, itemId, actualQuantity });
    return order;
  }
}

export class RestockApi implements IRestockApi {
  async getRestockOrders(signal?: AbortSignal): Promise<Order[]> {
    try {
      const response = await api.get('/orders', {
        params: { orderType: 'restock', status: 'ready', limit: 50 },
        signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener las reposiciones');
      }

      return response.data.data.map((order: any) => {
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
    } catch (error: any) {
      console.error('Error en getRestockOrders:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async confirmRestock(orderId: string, itemId: string, actualQuantity: number): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${orderId}/items/${itemId}/confirm-restock`, { actualQuantity });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al confirmar la reposición');
      }

      return {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
    } catch (error: any) {
      console.error('Error en confirmRestock:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al confirmar la reposición');
    }
  }
}

export const defaultRestockApi = new RestockApi();

import api from '@/api/api';
import type { Order, PaymentMethod } from '@/types';

export interface IDeliveryApi {
  getDeliveryOrders(signal?: AbortSignal): Promise<Order[]>;
  completeDelivery(orderId: string, paymentMethod: PaymentMethod): Promise<Order>;
}

export class DeliveryApi implements IDeliveryApi {
  async getDeliveryOrders(signal?: AbortSignal): Promise<Order[]> {
    try {
      const response = await api.get('/orders', {
        params: { status: 'ready', excludeOrderType: 'restock', limit: 50 },
        signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener pedidos de entrega');
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
      console.error('Error en getDeliveryOrders:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async completeDelivery(orderId: string, paymentMethod: PaymentMethod): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: 'delivered', paymentMethod });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al completar la entrega');
      }

      return {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt),
      };
    } catch (error: any) {
      console.error('Error en completeDelivery:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al completar la entrega');
    }
  }
}

export const defaultDeliveryApi = new DeliveryApi();

import type { Order } from '@/types';

export function isDeliveryOrder(order: Pick<Order, 'deliveryAddress' | 'deliveryCost'>): boolean {
  return Boolean(order.deliveryAddress) || (order.deliveryCost ?? 0) > 0;
}

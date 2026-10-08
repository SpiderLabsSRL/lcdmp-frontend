import { describe, it, expect } from 'vitest';
import { isDeliveryOrder } from '../orderUtils';

describe('isDeliveryOrder', () => {
  it('is true when the order has a delivery address', () => {
    expect(isDeliveryOrder({ deliveryAddress: 'Av. Siempre Viva 123', deliveryCost: 0 })).toBe(true);
  });

  it('is true when the order has a delivery cost but no address yet', () => {
    expect(isDeliveryOrder({ deliveryAddress: undefined, deliveryCost: 15 })).toBe(true);
  });

  it('is false when there is no address and no delivery cost', () => {
    expect(isDeliveryOrder({ deliveryAddress: undefined, deliveryCost: 0 })).toBe(false);
  });

  it('is false when deliveryCost is missing entirely', () => {
    expect(isDeliveryOrder({ deliveryAddress: undefined, deliveryCost: undefined as any })).toBe(false);
  });
});

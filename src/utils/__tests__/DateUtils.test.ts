import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLocalDateString, parseLocalDate, hoursUntilPickupDateTime } from '../DateUtils';
import type { Order } from '@/types';

const baseOrder: Order = {
  id: '1',
  orderNumber: 'ORD-1',
  orderType: 'cake',
  customerName: 'Cliente',
  customerPhone: '70000000',
  pickupDate: new Date(2026, 0, 15),
  pickupTime: '14:30',
  status: 'pending',
  items: [],
  customCakes: [],
  deliveryCost: 0,
  deposit: 0,
  total: 0,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
};

describe('getLocalDateString', () => {
  it('formats a given date as YYYY-MM-DD using local time', () => {
    expect(getLocalDateString(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('pads single-digit months and days with a leading zero', () => {
    expect(getLocalDateString(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('parseLocalDate', () => {
  it('parses a YYYY-MM-DD string into a local Date (no timezone shift)', () => {
    const result = parseLocalDate('2026-03-05');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(5);
  });

  it('round-trips with getLocalDateString', () => {
    const original = new Date(2026, 5, 20);
    const roundTripped = parseLocalDate(getLocalDateString(original));
    expect(roundTripped.getFullYear()).toBe(original.getFullYear());
    expect(roundTripped.getMonth()).toBe(original.getMonth());
    expect(roundTripped.getDate()).toBe(original.getDate());
  });
});

describe('hoursUntilPickupDateTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a positive number of hours when pickup is in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0));

    const hours = hoursUntilPickupDateTime(baseOrder);

    expect(hours).toBe(4);
  });

  it('returns a negative number of hours when pickup is in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 16, 10, 0));

    const hours = hoursUntilPickupDateTime(baseOrder);

    expect(hours).toBeLessThan(0);
  });
});

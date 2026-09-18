import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Order } from '@/types';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connected: false,
};

vi.mock('@/lib/socket', () => ({
  getSocket: () => mockSocket,
}));

import { useOrdersSocket } from '../useOrdersSocket';

const getHandler = (event: string) => {
  const call = mockSocket.on.mock.calls.find((c) => c[0] === event);
  if (!call) throw new Error(`No handler registered for "${event}"`);
  return call[1] as (...args: any[]) => void;
};

// A stable (never-recreated) empty array. useOrdersSocket has an effect keyed on
// `initialOrders` that calls setOrders(initialOrders); if we let the default
// parameter (`initialOrders = []`) run on every render, a brand-new array would be
// passed to setState on every render, which is a *different* reference each time and
// therefore never bails out of re-rendering - triggering an infinite render loop.
// Passing this same array reference everywhere keeps that effect from re-firing.
const EMPTY_ORDERS: Order[] = [];

const makeOrder = (overrides: Record<string, any> = {}) => ({
  id: '1',
  orderNumber: 'ORD-1',
  orderType: 'cake',
  customerName: 'Juan',
  customerPhone: '123',
  pickupDate: '2026-09-20',
  pickupTime: '10:00',
  status: 'pending',
  items: [],
  customCakes: [],
  deliveryCost: 0,
  deposit: 0,
  total: 100,
  createdAt: '2026-09-18T10:00:00.000Z',
  createdBy: 'u1',
  ...overrides,
});

describe('useOrdersSocket', () => {
  beforeEach(() => {
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.connected = false;
  });

  it('registers listeners for connect/disconnect/order events on mount', () => {
    renderHook(() => useOrdersSocket({ initialOrders: EMPTY_ORDERS }));

    const events = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        'connect',
        'disconnect',
        'order:created',
        'order:updated',
        'order:status_changed',
        'order:deleted',
      ])
    );
  });

  it('starts connected when socket.connected is already true at mount', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: EMPTY_ORDERS }));
    expect(result.current.isConnected).toBe(true);
  });

  it('starts disconnected when socket.connected is false at mount', () => {
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: EMPTY_ORDERS }));
    expect(result.current.isConnected).toBe(false);
  });

  it('updates isConnected on connect/disconnect events', () => {
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: EMPTY_ORDERS }));

    act(() => {
      getHandler('connect')();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      getHandler('disconnect')();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('adds a new order on order:created when it matches the status filter', () => {
    const { result } = renderHook(() =>
      useOrdersSocket({ statusFilter: ['pending'], initialOrders: EMPTY_ORDERS })
    );

    act(() => {
      getHandler('order:created')(makeOrder({ id: 'new-1', status: 'pending' }));
    });

    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].id).toBe('new-1');
  });

  it('ignores order:created when it does not match the status filter', () => {
    const { result } = renderHook(() =>
      useOrdersSocket({ statusFilter: ['ready'], initialOrders: EMPTY_ORDERS })
    );

    act(() => {
      getHandler('order:created')(makeOrder({ id: 'new-1', status: 'pending' }));
    });

    expect(result.current.orders).toHaveLength(0);
  });

  it('does not duplicate an order that is already present on order:created', () => {
    const initial = [makeOrder({ id: '1', status: 'pending' })] as unknown as Order[];
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: initial }));

    act(() => {
      getHandler('order:created')(makeOrder({ id: '1', status: 'pending' }));
    });

    expect(result.current.orders).toHaveLength(1);
  });

  it('updates an existing order on order:updated, and ignores unknown orders', () => {
    const initial = [makeOrder({ id: '1', customerName: 'Old Name' })] as unknown as Order[];
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: initial }));

    act(() => {
      getHandler('order:updated')(makeOrder({ id: '1', customerName: 'New Name' }));
    });
    expect(result.current.orders[0].customerName).toBe('New Name');

    act(() => {
      getHandler('order:updated')(makeOrder({ id: 'missing', customerName: 'Nope' }));
    });
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].customerName).toBe('New Name');
  });

  describe('order:status_changed', () => {
    it('adds the order when the new status now matches the filter', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['ready'], initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'a1',
          status: 'ready',
          order: makeOrder({ id: 'a1', status: 'ready' }),
        });
      });

      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].id).toBe('a1');
    });

    it('removes the order when the new status no longer matches the filter', () => {
      const initial = [makeOrder({ id: 'a1', status: 'pending' })] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['pending'], initialOrders: initial })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'a1',
          status: 'baking',
          order: makeOrder({ id: 'a1', status: 'baking' }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });

    it('updates the order in place when it still matches the filter', () => {
      const initial = [
        makeOrder({ id: 'a1', status: 'pending', customerName: 'Old' }),
      ] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['pending', 'baking'], initialOrders: initial })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'a1',
          status: 'baking',
          order: makeOrder({ id: 'a1', status: 'baking', customerName: 'New' }),
        });
      });

      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].customerName).toBe('New');
    });

    it('does nothing when the order is absent and still does not match the filter', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['ready'], initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'unknown',
          status: 'pending',
          order: makeOrder({ id: 'unknown', status: 'pending' }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });
  });

  it('removes an order on order:deleted', () => {
    const initial = [makeOrder({ id: '1' }), makeOrder({ id: '2' })] as unknown as Order[];
    const { result } = renderHook(() => useOrdersSocket({ initialOrders: initial }));

    act(() => {
      getHandler('order:deleted')({ id: '1' });
    });

    expect(result.current.orders.map((o) => o.id)).toEqual(['2']);
  });

  it('unregisters all listeners on unmount', () => {
    const { unmount } = renderHook(() => useOrdersSocket({ initialOrders: EMPTY_ORDERS }));
    unmount();

    const offEvents = mockSocket.off.mock.calls.map((c) => c[0]);
    expect(offEvents).toEqual(
      expect.arrayContaining([
        'connect',
        'disconnect',
        'order:created',
        'order:updated',
        'order:status_changed',
        'order:deleted',
      ])
    );
  });
});

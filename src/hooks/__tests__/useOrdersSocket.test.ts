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
        'order:item_stage_changed',
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

  describe('itemStageFilter', () => {
    it('adds an order on order:item_stage_changed when a line matches the stage', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:item_stage_changed')({
          orderId: 'a1',
          itemType: 'custom_cake',
          itemId: 'cake-1',
          stage: 'baking',
          order: makeOrder({
            id: 'a1',
            status: 'baking',
            customCakes: [{ id: 'cake-1', status: 'baking' }],
          }),
        });
      });

      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].id).toBe('a1');
    });

    it('updates an order in place on order:item_stage_changed when it still matches', () => {
      const initial = [
        makeOrder({
          id: 'a1',
          status: 'baking',
          customerName: 'Old',
          customCakes: [{ id: 'cake-1', status: 'baking' }],
        }),
      ] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: initial })
      );

      act(() => {
        getHandler('order:item_stage_changed')({
          orderId: 'a1',
          itemType: 'custom_cake',
          itemId: 'cake-1',
          stage: 'baking',
          order: makeOrder({
            id: 'a1',
            status: 'baking',
            customerName: 'New',
            customCakes: [{ id: 'cake-1', status: 'baking' }],
          }),
        });
      });

      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].customerName).toBe('New');
    });

    it('removes an order on order:item_stage_changed when no line matches the stage anymore', () => {
      const initial = [
        makeOrder({
          id: 'a1',
          status: 'assembling',
          customCakes: [{ id: 'cake-1', status: 'baking' }],
        }),
      ] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: initial })
      );

      act(() => {
        getHandler('order:item_stage_changed')({
          orderId: 'a1',
          itemType: 'custom_cake',
          itemId: 'cake-1',
          stage: 'assembling',
          order: makeOrder({
            id: 'a1',
            status: 'assembling',
            customCakes: [{ id: 'cake-1', status: 'assembling' }],
          }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });

    it('does nothing on order:item_stage_changed when the order still does not match', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:item_stage_changed')({
          orderId: 'unknown',
          itemType: 'custom_cake',
          itemId: 'cake-1',
          stage: 'assembling',
          order: makeOrder({
            id: 'unknown',
            status: 'assembling',
            customCakes: [{ id: 'cake-1', status: 'assembling' }],
          }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });

    it('respects itemStageFilter on order:created, adding only when a line matches', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:created')(
          makeOrder({ id: 'new-1', status: 'pending', customCakes: [{ id: 'c1', status: 'pending' }] })
        );
      });
      expect(result.current.orders).toHaveLength(0);

      act(() => {
        getHandler('order:created')(
          makeOrder({ id: 'new-2', status: 'baking', customCakes: [{ id: 'c2', status: 'baking' }] })
        );
      });
      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].id).toBe('new-2');
    });

    it('respects itemStageFilter on order:status_changed, adding/removing based on line status', () => {
      const initial = [
        makeOrder({
          id: 'a1',
          status: 'baking',
          customCakes: [{ id: 'cake-1', status: 'baking' }],
        }),
      ] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ itemStageFilter: 'baking', initialOrders: initial })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'a1',
          status: 'assembling',
          order: makeOrder({
            id: 'a1',
            status: 'assembling',
            customCakes: [{ id: 'cake-1', status: 'assembling' }],
          }),
        });
      });
      expect(result.current.orders).toHaveLength(0);

      act(() => {
        getHandler('order:status_changed')({
          id: 'a2',
          status: 'baking',
          order: makeOrder({
            id: 'a2',
            status: 'baking',
            customCakes: [{ id: 'cake-2', status: 'baking' }],
          }),
        });
      });
      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].id).toBe('a2');
    });
  });

  it('plain statusFilter usage (no itemStageFilter) still works as before (regression guard)', () => {
    const initial = [makeOrder({ id: 'a1', status: 'pending' })] as unknown as Order[];
    const { result } = renderHook(() =>
      useOrdersSocket({ statusFilter: ['pending'], initialOrders: initial })
    );

    act(() => {
      getHandler('order:created')(makeOrder({ id: 'a2', status: 'pending' }));
    });
    expect(result.current.orders.map((o) => o.id)).toEqual(['a2', 'a1']);

    act(() => {
      getHandler('order:status_changed')({
        id: 'a1',
        status: 'baking',
        order: makeOrder({ id: 'a1', status: 'baking' }),
      });
    });
    expect(result.current.orders.map((o) => o.id)).toEqual(['a2']);
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
        'order:item_stage_changed',
        'order:deleted',
      ])
    );
  });

  it('unregisters the order:item_stage_changed listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useOrdersSocket({ itemStageFilter: 'baking', initialOrders: EMPTY_ORDERS })
    );
    unmount();

    const offEvents = mockSocket.off.mock.calls.map((c) => c[0]);
    expect(offEvents).toContain('order:item_stage_changed');
  });

  describe('excludeOrderType', () => {
    it('does not add a new order on order:created when its orderType is excluded', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ excludeOrderType: 'restock', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:created')(makeOrder({ id: 'r1', orderType: 'restock', status: 'baking' }));
      });

      expect(result.current.orders).toHaveLength(0);
    });

    it('adds a new order on order:created when its orderType is not excluded', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ excludeOrderType: 'restock', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:created')(makeOrder({ id: 'c1', orderType: 'cake', status: 'pending' }));
      });

      expect(result.current.orders).toHaveLength(1);
    });

    it('removes an order from the list on order:status_changed if its orderType is excluded', () => {
      const initial = [makeOrder({ id: 'r1', orderType: 'restock', status: 'baking' })] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ excludeOrderType: 'restock', initialOrders: initial })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'r1',
          status: 'ready',
          order: makeOrder({ id: 'r1', orderType: 'restock', status: 'ready' }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });
  });

  describe('orderTypeFilter', () => {
    it('only adds orders that match the given orderType on order:created', () => {
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['ready'], orderTypeFilter: 'restock', initialOrders: EMPTY_ORDERS })
      );

      act(() => {
        getHandler('order:created')(makeOrder({ id: 'c1', orderType: 'cake', status: 'ready' }));
      });
      expect(result.current.orders).toHaveLength(0);

      act(() => {
        getHandler('order:created')(makeOrder({ id: 'r1', orderType: 'restock', status: 'ready' }));
      });
      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].id).toBe('r1');
    });

    it('removes an order on order:status_changed once it no longer matches the orderType filter', () => {
      const initial = [makeOrder({ id: 'r1', orderType: 'restock', status: 'ready' })] as unknown as Order[];
      const { result } = renderHook(() =>
        useOrdersSocket({ statusFilter: ['ready'], orderTypeFilter: 'restock', initialOrders: initial })
      );

      act(() => {
        getHandler('order:status_changed')({
          id: 'r1',
          status: 'delivered',
          order: makeOrder({ id: 'r1', orderType: 'restock', status: 'delivered' }),
        });
      });

      expect(result.current.orders).toHaveLength(0);
    });
  });
});

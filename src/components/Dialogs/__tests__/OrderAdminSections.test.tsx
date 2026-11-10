import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderHistorySection, OrderStatusControls } from '../OrderAdminSections';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { ItemStageLogEntry, Order } from '@/types';

// Radix Select usa ResizeObserver y pointer capture, que jsdom no implementa.
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

const makeApi = (log: ItemStageLogEntry[] = []) =>
  ({ getOrderProductionLog: vi.fn().mockResolvedValue(log) }) as unknown as IOrdersApi;

describe('OrderHistorySection', () => {
  it('does not fetch the log until expanded', () => {
    const api = makeApi();
    render(<OrderHistorySection orderId="o1" ordersApi={api} />);

    expect(api.getOrderProductionLog).not.toHaveBeenCalled();
  });

  it('fetches and renders the production log when expanded', async () => {
    const user = userEvent.setup();
    const api = makeApi([
      {
        id: 'log-1', itemType: 'custom_cake', itemId: 'c1', stage: 'baking',
        enteredAt: '2026-05-01T10:00:00.000Z', completedAt: '2026-05-01T12:00:00.000Z',
        completedById: 'u1', completedByName: 'Ana',
      },
    ]);
    render(<OrderHistorySection orderId="o1" ordersApi={api} />);

    await user.click(screen.getByRole('button', { name: /Historial de producción/ }));

    expect(api.getOrderProductionLog).toHaveBeenCalledWith('o1');
    await waitFor(() => expect(screen.getByText(/por Ana/)).toBeInTheDocument());
  });

  it('shows an empty-state message and does not re-fetch when toggled again', async () => {
    const user = userEvent.setup();
    const api = makeApi([]);
    render(<OrderHistorySection orderId="o1" ordersApi={api} />);
    const toggle = screen.getByRole('button', { name: /Historial de producción/ });

    await user.click(toggle);
    await waitFor(() => expect(screen.getByText('Sin historial de producción todavía.')).toBeInTheDocument());
    await user.click(toggle);
    await user.click(toggle);

    expect(api.getOrderProductionLog).toHaveBeenCalledTimes(1);
  });
});

describe('OrderStatusControls', () => {
  const order = {
    id: 'o1', status: 'baking', customCakes: [], sweetTableCombos: [], sweetTableExtras: [], mockups: [],
    items: [{ id: 'i1', productId: 'p1', productName: 'Alfajores', quantity: 6, price: 10, status: 'baking' }],
  } as unknown as Order;

  it('renders a selector for the whole order and one per product', () => {
    render(<OrderStatusControls order={order} onOrderStage={vi.fn()} onItemStage={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Estado del pedido' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Estado de 6 Alfajores/ })).toBeInTheDocument();
  });

  it('calls onItemStage with the line and the chosen stage', async () => {
    const user = userEvent.setup();
    const onItemStage = vi.fn();
    render(<OrderStatusControls order={order} onOrderStage={vi.fn()} onItemStage={onItemStage} />);

    await user.click(screen.getByRole('combobox', { name: /Estado de 6 Alfajores/ }));
    await user.click(await screen.findByRole('option', { name: 'Listo' }));

    expect(onItemStage).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'order_item', itemId: 'i1' }), 'ready');
  });
});

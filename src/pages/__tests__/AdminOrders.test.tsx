import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { IMaterialsApi } from '@/api/MaterialsApi';
import type { Order } from '@/types';
import { getLocalDateString } from '@/utils/DateUtils';

// Radix Select usa ResizeObserver y pointer capture, que jsdom no implementa.
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/api/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));

import AdminOrders from '../AdminOrders';

const order: Order = {
  id: '1',
  orderNumber: 'ORD-001',
  orderType: 'products',
  customerName: 'Maria Lopez',
  customerPhone: '77712345',
  pickupDate: new Date(2026, 9, 20),
  pickupTime: '15:00',
  status: 'baking',
  items: [{ id: 'i1', productId: 'p1', productName: 'Alfajores', quantity: 6, price: 10, status: 'baking' }],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 0,
  total: 60,
  createdAt: new Date(2026, 9, 1),
  createdBy: 'u1',
} as Order;

const buildApi = (): IOrdersApi => ({
  getOrders: vi.fn().mockResolvedValue([order]),
  getOrderById: vi.fn().mockResolvedValue(order),
  updateOrderStatus: vi.fn().mockResolvedValue(order),
  advanceItemStage: vi.fn().mockResolvedValue(order),
  getOrderProductionLog: vi.fn().mockResolvedValue([]),
  markOrderAtStore: vi.fn().mockResolvedValue(order),
} as unknown as IOrdersApi);

const materialsApi = { getMovements: vi.fn().mockResolvedValue([]) } as unknown as IMaterialsApi;

const renderPage = (api: IOrdersApi) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <AdminOrders ordersApi={api} materialsApi={materialsApi} />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AdminOrders', () => {
  it('by default asks for every status from today onward', async () => {
    const api = buildApi();
    renderPage(api);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    const filters = (api.getOrders as any).mock.calls[0][0];
    expect(getLocalDateString(filters.startDate)).toBe(getLocalDateString());
    expect(filters.endDate).toBeUndefined();
    expect(filters.allDates).toBe(true);
    expect(filters.status).toBeUndefined();
  });

  it('filters by a specific date', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    renderPage(api);
    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByRole('combobox', { name: 'Tipo de fecha' }));
    await user.click(await screen.findByRole('option', { name: 'Una fecha' }));
    const input = screen.getByLabelText('Fecha');
    await user.clear(input);
    await user.type(input, '2026-03-05');

    await waitFor(() => {
      const f = (api.getOrders as any).mock.calls.at(-1)[0];
      expect(getLocalDateString(f.startDate)).toBe('2026-03-05');
      expect(getLocalDateString(f.endDate)).toBe('2026-03-05');
    });
  });

  it('filters by a past date range', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    renderPage(api);
    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByRole('combobox', { name: 'Tipo de fecha' }));
    await user.click(await screen.findByRole('option', { name: 'Rango de fechas' }));
    await user.type(screen.getByLabelText('Desde'), '2025-01-01');
    await user.type(screen.getByLabelText('Hasta'), '2025-01-31');

    await waitFor(() => {
      const f = (api.getOrders as any).mock.calls.at(-1)[0];
      expect(getLocalDateString(f.startDate)).toBe('2025-01-01');
      expect(getLocalDateString(f.endDate)).toBe('2025-01-31');
    });
  });

  it('shows history, materials and cancel in the order detail, and cancels after confirming', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => true));
    const api = buildApi();
    renderPage(api);
    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByText('Maria Lopez'));
    await screen.findByText('Pedido #ORD-001');

    expect(screen.getByRole('button', { name: /Historial de producción/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cancelar Pedido/ }));

    await waitFor(() => expect(api.updateOrderStatus).toHaveBeenCalledWith('1', 'cancelled'));
  });

  it('changes the status of a single product', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    renderPage(api);
    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByText('Maria Lopez'));
    await user.click(await screen.findByRole('combobox', { name: /Estado de 6 Alfajores/ }));
    await user.click(await screen.findByRole('option', { name: 'Listo' }));

    await waitFor(() => expect(api.advanceItemStage).toHaveBeenCalledWith('1', 'order_item', 'i1', 'ready'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { Order, Product, Flavor, SweetTableCombo } from '@/types';

// Radix Select/Checkbox use ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;

// jsdom does not implement scrollIntoView / hasPointerCapture, used by Radix Select.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connected: false,
};
vi.mock('@/lib/socket', () => ({
  getSocket: () => fakeSocket,
  disconnectSocket: vi.fn(),
  default: () => fakeSocket,
}));

import { toast } from 'sonner';
import Orders from '../Orders';
import { useIsMobile } from '@/hooks/use-mobile';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

const mockedUseIsMobile = useIsMobile as unknown as ReturnType<typeof vi.fn>;

const flavors: Flavor[] = [
  { id: 'f1', name: 'Chocolate' } as Flavor,
  { id: 'f2', name: 'Vainilla' } as Flavor,
];

const products: Product[] = [
  { id: 'p1', name: 'Cupcake', basePrice: 10, category: 'cupcake' } as Product,
];

const combos: SweetTableCombo[] = [
  { id: 'c1', name: 'Combo 50', totalQuantity: 50, fixedPrice: 400, price: 400, products: [], isPreset: true, isActive: true } as SweetTableCombo,
];

const orderWithCake: Order = {
  id: '1',
  orderNumber: 'ORD-001',
  orderType: 'cake',
  customerName: 'Maria Lopez',
  customerPhone: '77712345',
  pickupDate: new Date(2026, 9, 20),
  pickupTime: '15:00',
  status: 'pending',
  items: [],
  customCakes: [
    {
      id: 'cake1',
      portions: 20,
      cakeFlavor: 'Chocolate',
      secondCakeFlavor: '',
      fillingFlavor: 'Chocolate',
      secondFillingFlavor: '',
      referenceImages: [],
      price: 150,
      quantity: 1,
    },
  ],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 50,
  total: 150,
  createdAt: new Date(2026, 9, 1),
  createdBy: 'u1',
};

const orderWithCombo: Order = {
  id: '2',
  orderNumber: 'ORD-002',
  orderType: 'sweet_table',
  customerName: 'Juan Perez',
  customerPhone: '70099887',
  pickupDate: new Date(2026, 9, 21),
  pickupTime: '10:00',
  status: 'baking',
  items: [],
  customCakes: [],
  sweetTableCombos: [
    { id: 'sc1', comboId: 'c1', name: 'Combo 50', totalQuantity: 50, price: 400, products: [] },
  ],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 100,
  total: 400,
  createdAt: new Date(2026, 9, 1),
  createdBy: 'u1',
};

const orderWithExtras: Order = {
  id: '3',
  orderNumber: 'ORD-003',
  orderType: 'sweet_table',
  customerName: 'Carla Rojas',
  customerPhone: '76655443',
  pickupDate: new Date(2026, 9, 22),
  pickupTime: '11:30',
  status: 'ready',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [
    { productId: 'p1', product: products[0], productName: 'Cupcake', quantity: 10, price: 10 },
  ],
  deliveryCost: 0,
  deposit: 0,
  total: 100,
  createdAt: new Date(2026, 9, 1),
  createdBy: 'u1',
};

const orderWithItems: Order = {
  id: '4',
  orderNumber: 'ORD-004',
  orderType: 'products',
  customerName: 'Pedro Diaz',
  customerPhone: '78877665',
  pickupDate: new Date(2026, 9, 23),
  pickupTime: '09:00',
  status: 'ready',
  items: [
    { productId: 'p1', product: products[0], productName: 'Cupcake', quantity: 5, price: 10 },
  ],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 0,
  total: 50,
  createdAt: new Date(2026, 9, 1),
  createdBy: 'u1',
};

const allOrders = [orderWithCake, orderWithCombo, orderWithExtras, orderWithItems];

function buildMockApi(overrides: Partial<IOrdersApi> = {}): IOrdersApi {
  return {
    getOrders: vi.fn().mockResolvedValue(allOrders),
    getOrderById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(allOrders.find(o => o.id === id) as Order)
    ),
    createOrder: vi.fn().mockResolvedValue(orderWithCake),
    updateOrder: vi.fn().mockResolvedValue(orderWithCake),
    deleteOrder: vi.fn().mockResolvedValue(undefined),
    updateOrderStatus: vi.fn().mockResolvedValue(orderWithCake),
    advanceItemStage: vi.fn().mockResolvedValue(orderWithCake),
    getOrderProductionLog: vi.fn().mockResolvedValue([]),
    getFlavors: vi.fn().mockResolvedValue(flavors),
    getProducts: vi.fn().mockResolvedValue(products),
    getSweetTableCombos: vi.fn().mockResolvedValue(combos),
    ...overrides,
  };
}

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

// stub window.confirm used by handleDeleteOrder
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockedUseIsMobile.mockReturnValue(false);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('Orders - loading & list states', () => {
  it('shows a loading spinner while orders are being fetched', async () => {
    let resolveOrders: (v: Order[]) => void;
    const pending = new Promise<Order[]>(resolve => { resolveOrders = resolve; });
    const api = buildMockApi({ getOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Orders ordersApi={api} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolveOrders!(allOrders);
    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());
  });

  it('shows the empty state when there are no orders', async () => {
    const api = buildMockApi({ getOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('No se encontraron pedidos')).toBeInTheDocument());
  });

  it('shows an error toast when loading fails', async () => {
    const api = buildMockApi({ getOrders: vi.fn().mockRejectedValue(new Error('boom')) });
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
  });

  it('renders the desktop table with custom cakes, combos, extras and catalog items', async () => {
    const api = buildMockApi();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Carla Rojas')).toBeInTheDocument();
    expect(screen.getByText('Pedro Diaz')).toBeInTheDocument();

    expect(screen.getByText('20p Chocolate')).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce (50 postres)')).toBeInTheDocument();
    expect(screen.getByText(/Mesa Dulce: 10 Cupcake/)).toBeInTheDocument();
    expect(screen.getByText('5 Cupcake')).toBeInTheDocument();
  });

  it('renders mobile cards with the same order data when useIsMobile is true', async () => {
    mockedUseIsMobile.mockReturnValue(true);
    const api = buildMockApi();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('#ORD-001')).toBeInTheDocument();
    expect(screen.getByText('20p Chocolate')).toBeInTheDocument();
  });
});

describe('Orders - filters', () => {
  it('reloads with the search term after the debounce delay', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Buscar por nombre o teléfono...'), 'Maria');

    await waitFor(
      () => expect(api.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: 'Maria' }),
        expect.anything()
      ),
      { timeout: 2000 }
    );
  });

  it('searches by phone when the search term is numeric', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Buscar por nombre o teléfono...'), '77712345');

    await waitFor(
      () => expect(api.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ customerPhone: '77712345' }),
        expect.anything()
      ),
      { timeout: 2000 }
    );
  });

  it('reloads with the selected status filter when a status stat card is clicked', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    // Stat cards render statuses baking..delivered (stats.slice(1,5)); click 'Horneando' (baking).
    // "Horneando" also appears in the baking order's status select trigger, so scope to the stat card.
    const statCard = screen.getAllByText('Horneando')
      .map(el => el.closest('.cursor-pointer'))
      .find((el): el is HTMLElement => el !== null)!;
    await user.click(statCard);

    await waitFor(() =>
      expect(api.getOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'baking' }),
        expect.anything()
      )
    );
  });

  it('resets filters via the reset button', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Buscar por nombre o teléfono...'), 'Maria');
    await user.click(screen.getByTitle('Restablecer filtros'));

    expect(toast.info).toHaveBeenCalledWith('Filtros restablecidos');
    expect((screen.getByPlaceholderText('Buscar por nombre o teléfono...') as HTMLInputElement).value).toBe('');
  });
});

describe('Orders - row/card click opens detail dialog', () => {
  it('desktop: clicking a table row opens the order detail dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByText('Maria Lopez'));

    await waitFor(() => expect(api.getOrderById).toHaveBeenCalledWith('1'));
    expect(await screen.findByText('Pedido #ORD-001')).toBeInTheDocument();
  });

  it('mobile: clicking a card opens the order detail dialog', async () => {
    mockedUseIsMobile.mockReturnValue(true);
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByText('Maria Lopez'));

    await waitFor(() => expect(api.getOrderById).toHaveBeenCalledWith('1'));
    expect(await screen.findByText('Pedido #ORD-001')).toBeInTheDocument();
  });

  it('desktop: clicking Editar does not also open the detail dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    const row = screen.getByText('Maria Lopez').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Editar/i }));

    await waitFor(() => expect(screen.getByText('Editar Pedido #ORD-001')).toBeInTheDocument());
    expect(screen.queryByText('Pedido #ORD-001')).not.toBeInTheDocument();
  });

  it('desktop: clicking Eliminar does not open the detail dialog and calls deleteOrder', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    const row = screen.getByText('Maria Lopez').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Eliminar/i }));

    await waitFor(() => expect(api.deleteOrder).toHaveBeenCalledWith('1'));
    expect(screen.queryByText('Pedido #ORD-001')).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Pedido eliminado exitosamente');
  });

  it('desktop: the row status is a read-only badge, not an editable select, and clicking it does not open the detail dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    const row = screen.getByText('Maria Lopez').closest('tr')!;
    expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();

    const statusBadge = within(row).getByText('Pendiente');
    await user.click(statusBadge);

    expect(api.updateOrderStatus).not.toHaveBeenCalled();
    expect(screen.queryByText('Pedido #ORD-001')).not.toBeInTheDocument();
  });
});

describe('Orders - cancel order from detail dialog', () => {
  it('cancels the order via the detail dialog and reloads the list', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByText('Maria Lopez'));
    await screen.findByText('Pedido #ORD-001');

    await user.click(screen.getByRole('button', { name: /Cancelar Pedido/i }));

    await waitFor(() => expect(api.updateOrderStatus).toHaveBeenCalledWith('1', 'cancelled', undefined));
    expect(screen.queryByText('Pedido #ORD-001')).not.toBeInTheDocument();
  });
});

describe('Orders - create dialog', () => {
  it('opens the create order dialog via "Nuevo Pedido"', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Orders ordersApi={api} />);

    await waitFor(() => expect(screen.getByText('Maria Lopez')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Nuevo Pedido/i }));

    expect(screen.getByRole('heading', { name: 'Nuevo Pedido' })).toBeInTheDocument();
  });
});

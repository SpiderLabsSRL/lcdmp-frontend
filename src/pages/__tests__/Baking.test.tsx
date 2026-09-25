import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { AuthProvider } from '@/contexts/AuthContext';
import Baking from '../Baking';
import type { Order } from '@/types';
import type { IBakingApi } from '@/api/BakingApi';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/hooks/useOrdersSocket', () => ({
  useOrdersSocket: ({ initialOrders }: any) => ({
    orders: initialOrders,
    setOrders: vi.fn(),
    isConnected: true,
  }),
}));

import { toast } from 'sonner';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  orderNumber: 'ORD-100',
  orderType: 'mixed',
  customerName: 'Pedro Gomez',
  customerPhone: '70099988',
  pickupDate: new Date(2027, 0, 20),
  pickupTime: '10:00',
  status: 'baking',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 50,
  total: 300,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
  ...overrides,
});

// Order with one line item of every kind, all sitting in 'baking'.
const fullOrder = makeOrder({
  customCakes: [
    {
      id: 'cake-1',
      portions: 20,
      shape: 'Redonda',
      cakeFlavor: 'Vainilla',
      secondCakeFlavor: '',
      fillingFlavor: 'Fresa',
      secondFillingFlavor: '',
      referenceImages: [],
      price: 200,
      quantity: 2,
      status: 'baking',
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ id: 'cp-1', productId: 'p1', productName: 'Alfajores', quantity: 10, pricePerUnit: 3, status: 'baking' }],
      totalQuantity: 10,
      price: 30,
    },
  ],
  sweetTableExtras: [
    { id: 'extra-1', productId: 'p2', product: {} as any, productName: 'Brownies', quantity: 8, price: 4, status: 'baking' },
  ],
  items: [
    { id: 'item-1', productId: 'p3', product: {} as any, productName: 'Pan integral', quantity: 3, price: 15, status: 'baking' },
  ],
});

// Order with a single custom cake in 'baking', for unambiguous dialog interactions.
const singleCakeOrder = makeOrder({
  id: 'order-2',
  orderNumber: 'ORD-101',
  customCakes: [
    {
      id: 'cake-2',
      portions: 15,
      cakeFlavor: 'Chocolate',
      secondCakeFlavor: '',
      fillingFlavor: 'Manjar',
      secondFillingFlavor: '',
      referenceImages: [],
      price: 150,
      quantity: 1,
      status: 'baking',
    },
  ],
});

function buildMockApi(overrides: Partial<IBakingApi> = {}): IBakingApi {
  return {
    getBakingOrders: vi.fn().mockResolvedValue([]),
    getBakedProductsStock: vi.fn().mockResolvedValue([]),
    updateOrderStatus: vi.fn(),
    completeItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Baking', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a loading state while orders are being fetched', async () => {
    let resolvePromise: (value: Order[]) => void = () => {};
    const pending = new Promise<Order[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Baking bakingApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no work items to bake', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    expect(await screen.findByText('No hay productos pendientes de hornear')).toBeInTheDocument();
  });

  it('renders one card per work item (cake, combo product, extra, catalog item) and computes stats', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    // Four cards, each showing the order number / customer once per card.
    const orderNumberBadges = await screen.findAllByText('#ORD-100');
    expect(orderNumberBadges).toHaveLength(4);
    expect(screen.getAllByText('Pedro Gomez')).toHaveLength(4);

    expect(screen.getByText(/20 porciones - Vainilla/)).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 10 Alfajores')).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 8 Brownies')).toBeInTheDocument();
    expect(screen.getByText('3 Pan integral')).toBeInTheDocument();

    // Stats: 4 pending lines, totalPortions only counts custom_cake quantity (2).
    expect(screen.getByText('Líneas pendientes').previousSibling?.textContent).toBe('4');
    expect(screen.getByText('Porciones a hornear').previousSibling?.textContent).toBe('2');
  });

  it('flags items with a pickup less than 12h away as urgent', async () => {
    const soon = new Date();
    const urgentOrder = makeOrder({
      id: 'order-3',
      orderNumber: 'ORD-102',
      pickupDate: soon,
      pickupTime: format(addHours(soon, 2), 'HH:mm'),
      customCakes: [
        {
          id: 'cake-3',
          portions: 10,
          cakeFlavor: 'Limon',
          secondCakeFlavor: '',
          fillingFlavor: 'Limon',
          secondFillingFlavor: '',
          referenceImages: [],
          price: 100,
          quantity: 1,
          status: 'baking',
        },
      ],
    });
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([urgentOrder]) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-102');
    expect(screen.getByText('Urgentes (<12h)').previousSibling?.textContent).toBe('1');
  });

  it('opens the complete dialog and completes the item, showing a success toast', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-101');
    await user.click(screen.getByRole('button', { name: 'Completar' }));

    expect(await screen.findByText('Completar Horneado')).toBeInTheDocument();
    expect(screen.getByText('Pedido #ORD-101')).toBeInTheDocument();
    expect(screen.getAllByText(/15 porciones - Chocolate/).length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: /Confirmar Horneado/i }));

    await waitFor(() => expect(mockApi.completeItem).toHaveBeenCalledWith('order-2', 'custom_cake', 'cake-2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Horneado completado, enviado a armado'));
    expect(screen.queryByText('Completar Horneado')).not.toBeInTheDocument();
  });

  it('closes the dialog without completing when Cancelar is clicked', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-101');
    await user.click(screen.getByRole('button', { name: 'Completar' }));
    expect(await screen.findByText('Completar Horneado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Completar Horneado')).not.toBeInTheDocument();
    expect(mockApi.completeItem).not.toHaveBeenCalled();
  });

  it('shows an error toast when completing the item fails', async () => {
    const mockApi = buildMockApi({
      getBakingOrders: vi.fn().mockResolvedValue([singleCakeOrder]),
      completeItem: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const user = userEvent.setup();
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-101');
    await user.click(screen.getByRole('button', { name: 'Completar' }));
    await user.click(screen.getByRole('button', { name: /Confirmar Horneado/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al completar el horneado'));
  });

  it('shows an error toast when loading the initial orders fails', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockRejectedValue(new Error('network down')) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar los datos'));
    expect(await screen.findByText('No hay productos pendientes de hornear')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { AuthProvider } from '@/contexts/AuthContext';
import Decoration from '../Decoration';
import type { Order } from '@/types';
import type { IDecorationApi } from '@/api/DecorationApi';

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
  orderNumber: 'ORD-200',
  orderType: 'mixed',
  customerName: 'Ana Rojas',
  customerPhone: '70088877',
  pickupDate: new Date(2027, 0, 20),
  pickupTime: '12:00',
  status: 'decorating',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 80,
  total: 400,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
  ...overrides,
});

// Order with one line item of every kind, all sitting in 'decorating'.
const fullOrder = makeOrder({
  customCakes: [
    {
      id: 'cake-1',
      portions: 25,
      shape: 'Cuadrada',
      cakeFlavor: 'Red Velvet',
      secondCakeFlavor: '',
      fillingFlavor: 'Queso crema',
      secondFillingFlavor: '',
      design: 'Flores rosas',
      dedication: 'Feliz cumpleaños',
      referenceImages: ['https://example.com/ref1.png'],
      price: 250,
      quantity: 1,
      status: 'decorating',
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ id: 'cp-1', productId: 'p1', productName: 'Macarons', quantity: 15, pricePerUnit: 4, status: 'decorating' }],
      totalQuantity: 15,
      price: 60,
      details: 'Colores pastel',
    },
  ],
  sweetTableExtras: [
    { id: 'extra-1', productId: 'p2', product: {} as any, productName: 'Cupcakes decorados', quantity: 6, price: 6, status: 'decorating' },
  ],
  items: [
    { id: 'item-1', productId: 'p3', product: {} as any, productName: 'Torta express', quantity: 1, price: 50, notes: 'Sin gluten', status: 'decorating' },
  ],
  notes: 'Recoger temprano',
});

// Order with a single custom cake in 'decorating', for unambiguous dialog interactions.
const singleCakeOrder = makeOrder({
  id: 'order-2',
  orderNumber: 'ORD-201',
  customCakes: [
    {
      id: 'cake-2',
      portions: 12,
      cakeFlavor: 'Vainilla',
      secondCakeFlavor: '',
      fillingFlavor: 'Fresa',
      secondFillingFlavor: '',
      design: 'Tema de unicornios',
      dedication: 'Feliz cumple Sofia',
      referenceImages: [],
      price: 120,
      quantity: 1,
      status: 'decorating',
    },
  ],
});

function buildMockApi(overrides: Partial<IDecorationApi> = {}): IDecorationApi {
  return {
    getDecorationOrders: vi.fn().mockResolvedValue([]),
    completeItem: vi.fn().mockResolvedValue(undefined),
    getOrderDetails: vi.fn(),
    ...overrides,
  };
}

describe('Decoration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.innerWidth = 1024;
  });

  it('shows a loading state while orders are being fetched', async () => {
    let resolvePromise: (value: Order[]) => void = () => {};
    const pending = new Promise<Order[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Decoration decorationApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no work items to decorate', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    expect(await screen.findByText('No hay productos pendientes de decorar')).toBeInTheDocument();
  });

  it('renders one card per work item, showing the cake design as detail, and computes stats', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    const orderNumberBadges = await screen.findAllByText('#ORD-200');
    expect(orderNumberBadges).toHaveLength(4);
    expect(screen.getAllByText('Ana Rojas')).toHaveLength(4);

    expect(screen.getByText(/25 porciones - Red Velvet/)).toBeInTheDocument();
    expect(screen.getByText(/🎨 Flores rosas/)).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 15 Macarons')).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 6 Cupcakes decorados')).toBeInTheDocument();
    expect(screen.getByText('1 Torta express')).toBeInTheDocument();

    expect(screen.getByText('Pendientes de decorar')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('flags items with a pickup less than 6h away as urgent', async () => {
    const soon = new Date();
    const urgentOrder = makeOrder({
      id: 'order-3',
      orderNumber: 'ORD-202',
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
          status: 'decorating',
        },
      ],
    });
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([urgentOrder]) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-202');
    expect(screen.getByText('Urgentes (<6h)').previousSibling?.textContent).toBe('1');
  });

  it('opens the order-detail dialog when clicking a card, showing design/dedication/reference images', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-201');
    // Click on the customer name, not the dedicated "Completar" button.
    await user.click(screen.getByText('Ana Rojas'));

    expect(await screen.findByText('Detalles del Pedido #ORD-201')).toBeInTheDocument();
    expect(screen.getByText('Tema de unicornios')).toBeInTheDocument();
    expect(screen.getByText('Dedicatoria: "Feliz cumple Sofia"')).toBeInTheDocument();
  });

  it('shows the order-level notes in the detail dialog', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findAllByText('#ORD-200');
    await user.click(screen.getAllByText('Ana Rojas')[0]);

    expect(await screen.findByText('Detalles del Pedido #ORD-200')).toBeInTheDocument();
    expect(screen.getByText('Recoger temprano')).toBeInTheDocument();
  });

  it('opens the order-detail dialog when clicking the mobile card', async () => {
    window.innerWidth = 400;
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-201');
    await user.click(screen.getByText('Ana Rojas'));

    expect(await screen.findByText('Detalles del Pedido #ORD-201')).toBeInTheDocument();
  });

  it('opens the complete dialog, allows optional notes, and completes the item without sending the notes', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-201');
    await user.click(screen.getByRole('button', { name: /Completar/i }));

    expect(await screen.findByText('Completar Decoración')).toBeInTheDocument();
    expect(screen.getByText('Pedido #ORD-201')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Observaciones adicionales...'), 'Quedó perfecto');

    await user.click(screen.getByRole('button', { name: /Marcar como Listo/i }));

    await waitFor(() => expect(mockApi.completeItem).toHaveBeenCalledWith('order-2', 'custom_cake', 'cake-2'));
    expect((mockApi.completeItem as any).mock.calls[0]).toHaveLength(3);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Decoración completada, listo para entrega'));
    expect(screen.queryByText('Completar Decoración')).not.toBeInTheDocument();
  });

  it('closes the dialog without completing when Cancelar is clicked', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-201');
    await user.click(screen.getByRole('button', { name: /Completar/i }));
    expect(await screen.findByText('Completar Decoración')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Completar Decoración')).not.toBeInTheDocument();
    expect(mockApi.completeItem).not.toHaveBeenCalled();
  });

  it('shows an error toast when completing the item fails', async () => {
    const mockApi = buildMockApi({
      getDecorationOrders: vi.fn().mockResolvedValue([singleCakeOrder]),
      completeItem: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-201');
    await user.click(screen.getByRole('button', { name: /Completar/i }));
    await user.click(screen.getByRole('button', { name: /Marcar como Listo/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al completar la decoración'));
  });

  it('shows an error toast when loading the initial orders fails', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockRejectedValue(new Error('network down')) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar los pedidos de decoración'));
    expect(await screen.findByText('No hay productos pendientes de decorar')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Decoration from '../Decoration';
import type { Order } from '@/types';
import type { IDecorationApi } from '@/api/DecorationApi';

vi.mock('@/hooks/useOrdersSocket', () => ({
  useOrdersSocket: ({ initialOrders }: any) => ({
    orders: initialOrders,
    setOrders: vi.fn(),
    isConnected: true,
  }),
}));

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
      referenceImages: [],
      price: 250,
      quantity: 1,
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ productId: 'p1', productName: 'Macarons', quantity: 15, pricePerUnit: 4 }],
      totalQuantity: 15,
      price: 60,
      details: 'Colores pastel',
    },
  ],
  sweetTableExtras: [
    { productId: 'p2', product: { id: 'p2', name: 'Cupcakes decorados' } as any, productName: 'Cupcakes decorados', quantity: 6, price: 6 },
  ],
  items: [
    { productId: 'p3', product: {} as any, productName: 'Torta express', quantity: 1, price: 50, notes: 'Sin gluten' },
  ],
  notes: 'Recoger temprano',
});

function buildMockApi(overrides: Partial<IDecorationApi> = {}): IDecorationApi {
  return {
    getDecorationOrders: vi.fn().mockResolvedValue([]),
    completeDecoration: vi.fn().mockResolvedValue(undefined),
    getOrderDetails: vi.fn(),
    ...overrides,
  };
}

describe('Decoration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  it('shows an empty state when there are no orders to decorate', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    expect(await screen.findByText('No hay pedidos pendientes de decorar')).toBeInTheDocument();
  });

  it('renders a populated order list with cakes, combos, extras, items and notes', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    expect(await screen.findByText('#ORD-200')).toBeInTheDocument();
    expect(screen.getByText('Ana Rojas')).toBeInTheDocument();
    expect(screen.getByText(/25 porciones/)).toBeInTheDocument();
    expect(screen.getByText(/Red Velvet/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce 15 Macarons - Colores pastel/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce: 6 Cupcakes decorados/)).toBeInTheDocument();
    expect(screen.getByText(/Torta express - 1 Unidades/)).toBeInTheDocument();
    expect(screen.getByText('Recoger temprano')).toBeInTheDocument();
  });

  it('opens the order-detail dialog when clicking anywhere on the desktop row', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-200');
    // Click on the customer name, not the dedicated "Completar" button.
    await user.click(screen.getByText('Ana Rojas'));

    expect(await screen.findByText('Detalles del Pedido #ORD-200')).toBeInTheDocument();
    expect(screen.getByText('Flores rosas')).toBeInTheDocument();
    expect(screen.getByText('Dedicatoria: "Feliz cumpleaños"')).toBeInTheDocument();
  });

  it('opens the complete dialog pre-checking cakes, combos and extras but not items', async () => {
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-200');
    await user.click(screen.getByRole('button', { name: /Completar/i }));

    expect(await screen.findByText('Completar Decoración')).toBeInTheDocument();

    expect(document.querySelector('#cake-dec-0')).toHaveAttribute('data-state', 'checked');
    expect(document.querySelector('#combo-dec-0')).toHaveAttribute('data-state', 'checked');
    expect(document.querySelector('#extra-dec-0')).toHaveAttribute('data-state', 'checked');
    expect(document.querySelector('#item-dec-0')).toHaveAttribute('data-state', 'unchecked');

    await user.click(screen.getByRole('button', { name: /Marcar como Listo/i }));

    await waitFor(() => expect(mockApi.completeDecoration).toHaveBeenCalledTimes(1));
    expect(mockApi.completeDecoration).toHaveBeenCalledWith('order-1', '');
  });

  it('opens the order-detail dialog when clicking the mobile card', async () => {
    window.innerWidth = 400;
    const mockApi = buildMockApi({ getDecorationOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Decoration decorationApi={mockApi} />);

    await screen.findByText('#ORD-200');
    await user.click(screen.getByText('Ana Rojas'));

    expect(await screen.findByText('Detalles del Pedido #ORD-200')).toBeInTheDocument();

    // Restore desktop width for subsequent tests in this process.
    window.innerWidth = 1024;
  });
});

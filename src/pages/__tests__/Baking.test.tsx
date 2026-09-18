import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Baking from '../Baking';
import type { Order } from '@/types';
import type { IBakingApi } from '@/api/BakingApi';

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
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ productId: 'p1', productName: 'Alfajores', quantity: 10, pricePerUnit: 3 }],
      totalQuantity: 10,
      price: 30,
    },
  ],
  sweetTableExtras: [
    { productId: 'p2', product: { id: 'p2', name: 'Brownies' } as any, productName: 'Brownies', quantity: 8, price: 4 },
  ],
  items: [
    { productId: 'p3', product: {} as any, productName: 'Pan integral', quantity: 3, price: 15 },
  ],
});

function buildMockApi(overrides: Partial<IBakingApi> = {}): IBakingApi {
  return {
    getBakingOrders: vi.fn().mockResolvedValue([]),
    getBakedProductsStock: vi.fn().mockResolvedValue([]),
    updateOrderStatus: vi.fn(),
    completeBaking: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Baking', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  it('shows an empty state when there are no orders to bake', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    expect(await screen.findByText('No hay pedidos pendientes de hornear')).toBeInTheDocument();
  });

  it('renders a populated order list with cakes, combos, extras and items', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Baking bakingApi={mockApi} />);

    expect(await screen.findByText('#ORD-100')).toBeInTheDocument();
    expect(screen.getByText('Pedro Gomez')).toBeInTheDocument();
    expect(screen.getByText(/20 porciones/)).toBeInTheDocument();
    expect(screen.getByText(/Vainilla/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce: 10 Alfajores/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce: 8 Brownies/)).toBeInTheDocument();
    expect(screen.getByText(/Pan integral/)).toBeInTheDocument();
  });

  it('marks a pending order as baking', async () => {
    const pendingOrder = makeOrder({ status: 'pending' });
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([pendingOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-100');
    await user.click(screen.getByRole('button', { name: 'Iniciar' }));

    await waitFor(() => expect(mockApi.updateOrderStatus).toHaveBeenCalledWith('order-1', 'baking'));
  });

  it('opens the complete dialog pre-filled with baked quantities and completes baking', async () => {
    const mockApi = buildMockApi({ getBakingOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Baking bakingApi={mockApi} />);

    await screen.findByText('#ORD-100');
    await user.click(screen.getByRole('button', { name: 'Completar' }));

    expect(await screen.findByText('Completar Horneado')).toBeInTheDocument();
    const quantityInput = screen.getByDisplayValue('1') as HTMLInputElement;
    expect(quantityInput).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirmar Horneado/i }));

    await waitFor(() => expect(mockApi.completeBaking).toHaveBeenCalledTimes(1));
    const [orderId, bakedMap] = (mockApi.completeBaking as any).mock.calls[0];
    expect(orderId).toBe('order-1');
    expect(bakedMap.get('Vainilla')).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Delivery from '../Delivery';
import type { Order } from '@/types';
import type { IDeliveryApi } from '@/api/DeliveryApi';

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
  orderNumber: 'ORD-300',
  orderType: 'mixed',
  customerName: 'Luis Choque',
  customerPhone: '70077766',
  pickupDate: new Date(2027, 0, 20),
  pickupTime: '16:00',
  status: 'ready',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 20,
  deposit: 100,
  total: 400,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
  ...overrides,
});

const deliveryOrder = makeOrder({
  deliveryAddress: 'Av. Siempre Viva 123',
  customCakes: [
    {
      id: 'cake-1',
      portions: 15,
      cakeFlavor: 'Naranja',
      secondCakeFlavor: '',
      fillingFlavor: 'Manjar',
      secondFillingFlavor: '',
      referenceImages: [],
      price: 150,
      quantity: 1,
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ productId: 'p1', productName: 'Tartaletas', quantity: 6, pricePerUnit: 5 }],
      totalQuantity: 6,
      price: 30,
    },
  ],
  sweetTableExtras: [
    { productId: 'p2', product: { id: 'p2', name: 'Donas' } as any, productName: 'Donas', quantity: 4, price: 3 },
  ],
  items: [
    { productId: 'p3', product: {} as any, productName: 'Pan de queso', quantity: 2, price: 8 },
  ],
  notes: 'Timbre no funciona',
});

const pickupOrder = makeOrder({
  id: 'order-2',
  orderNumber: 'ORD-301',
  customerName: 'Marta Salas',
});

function buildMockApi(overrides: Partial<IDeliveryApi> = {}): IDeliveryApi {
  return {
    getDeliveryOrders: vi.fn().mockResolvedValue([]),
    completeDelivery: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Delivery', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows a loading state while orders are being fetched', async () => {
    let resolvePromise: (value: Order[]) => void = () => {};
    const pending = new Promise<Order[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getDeliveryOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Delivery deliveryApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows empty states for both deliveries and pickups when there are no orders', async () => {
    const mockApi = buildMockApi({ getDeliveryOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Delivery deliveryApi={mockApi} />);

    expect(await screen.findByText('No hay entregas pendientes')).toBeInTheDocument();
    expect(screen.getByText('No hay recogidas pendientes')).toBeInTheDocument();
  });

  it('renders a populated order list split into deliveries and pickups', async () => {
    const mockApi = buildMockApi({ getDeliveryOrders: vi.fn().mockResolvedValue([deliveryOrder, pickupOrder]) });
    renderWithProviders(<Delivery deliveryApi={mockApi} />);

    expect(await screen.findByText('#ORD-300')).toBeInTheDocument();
    expect(screen.getByText('#ORD-301')).toBeInTheDocument();
    expect(screen.getByText(/15 porciones/)).toBeInTheDocument();
    expect(screen.getByText(/Naranja/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce: 6 Tartaletas/)).toBeInTheDocument();
    expect(screen.getByText(/Mesa dulce: 4 Donas/)).toBeInTheDocument();
    expect(screen.getByText(/Pan de queso/)).toBeInTheDocument();
    expect(screen.getByText(/Timbre no funciona/)).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 123')).toBeInTheDocument();
  });

  it('opens the complete dialog and confirms delivery with cash by default', async () => {
    const mockApi = buildMockApi({ getDeliveryOrders: vi.fn().mockResolvedValue([deliveryOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Delivery deliveryApi={mockApi} />);

    await screen.findByText('#ORD-300');
    await user.click(screen.getByRole('button', { name: /Entregado/i }));

    expect(await screen.findByRole('heading', { name: 'Confirmar Entrega' })).toBeInTheDocument();
    expect(screen.getByText('Bs. 300')).toBeInTheDocument(); // total 400 - deposit 100

    await user.click(screen.getByRole('button', { name: /Confirmar Entrega/i }));

    await waitFor(() => expect(mockApi.completeDelivery).toHaveBeenCalledWith('order-1', 'cash'));
  });

  it('confirms delivery with the selected payment method', async () => {
    const mockApi = buildMockApi({ getDeliveryOrders: vi.fn().mockResolvedValue([deliveryOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Delivery deliveryApi={mockApi} />);

    await screen.findByText('#ORD-300');
    await user.click(screen.getByRole('button', { name: /Entregado/i }));

    await screen.findByRole('heading', { name: 'Confirmar Entrega' });
    await user.click(screen.getByRole('button', { name: /^QR$/i }));
    await user.click(screen.getByRole('button', { name: /Confirmar Entrega/i }));

    await waitFor(() => expect(mockApi.completeDelivery).toHaveBeenCalledWith('order-1', 'qr'));
  });
});

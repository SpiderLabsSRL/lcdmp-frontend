import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Assembly from '../Assembly';
import type { Order } from '@/types';
import type { IAssemblyApi } from '@/api/AssemblyApi';

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
  orderNumber: 'ORD-001',
  orderType: 'mixed',
  customerName: 'Juana Perez',
  customerPhone: '70011122',
  pickupDate: new Date(2027, 0, 20),
  pickupTime: '15:00',
  status: 'assembling',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 100,
  total: 500,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
  ...overrides,
});

const fullOrder = makeOrder({
  customCakes: [
    {
      id: 'cake-1',
      portions: 30,
      cakeFlavor: 'Chocolate',
      secondCakeFlavor: '',
      fillingFlavor: 'Dulce de leche',
      secondFillingFlavor: '',
      referenceImages: [],
      price: 300,
      quantity: 1,
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ productId: 'p1', productName: 'Cupcakes', quantity: 12, pricePerUnit: 5 }],
      totalQuantity: 12,
      price: 60,
      details: 'Sin nueces',
    },
  ],
  sweetTableExtras: [
    { productId: 'p2', product: { id: 'p2', name: 'Galletas' } as any, productName: 'Galletas', quantity: 20, price: 2 },
  ],
  items: [
    { productId: 'p3', product: {} as any, productName: 'Pan dulce', quantity: 5, price: 10, notes: 'Sin azúcar' },
  ],
  notes: 'Entregar antes de las 3pm',
});

function buildMockApi(overrides: Partial<IAssemblyApi> = {}): IAssemblyApi {
  return {
    getAssemblyOrders: vi.fn().mockResolvedValue([]),
    updateOrderStatus: vi.fn(),
    completeAssembly: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Assembly', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows a loading state while orders are being fetched', async () => {
    let resolvePromise: (value: Order[]) => void = () => {};
    const pending = new Promise<Order[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Assembly assemblyApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no orders to assemble', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    expect(await screen.findByText('No hay pedidos pendientes de armar')).toBeInTheDocument();
    expect(mockApi.getAssemblyOrders).toHaveBeenCalledTimes(1);
  });

  it('renders a populated order list with cakes, combos, extras, items and notes', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    expect(await screen.findByText('#ORD-001')).toBeInTheDocument();
    expect(screen.getByText('Juana Perez')).toBeInTheDocument();
    expect(screen.getByText('30 porciones')).toBeInTheDocument();
    expect(screen.getByText(/Chocolate/)).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce 12 Cupcakes - Sin nueces')).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 20 Galletas')).toBeInTheDocument();
    expect(screen.getByText('Pan dulce - 5 Unidades')).toBeInTheDocument();
    expect(screen.getByText('Entregar antes de las 3pm')).toBeInTheDocument();
  });

  it('opens the complete dialog with cakes pre-checked but items unchecked, and completes assembly', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([fullOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await screen.findByText('#ORD-001');
    await user.click(screen.getByRole('button', { name: /Completar/i }));

    expect(await screen.findByText('Completar Armado')).toBeInTheDocument();

    const cakeCheckbox = document.querySelector('#cake-0');
    const itemCheckbox = document.querySelector('#item-0');
    expect(cakeCheckbox).toHaveAttribute('data-state', 'checked');
    expect(itemCheckbox).toHaveAttribute('data-state', 'unchecked');

    await user.click(screen.getByRole('button', { name: /Enviar a Decoración/i }));

    await waitFor(() => expect(mockApi.completeAssembly).toHaveBeenCalledTimes(1));
    const [orderId, assembledMap] = (mockApi.completeAssembly as any).mock.calls[0];
    expect(orderId).toBe('order-1');
    expect(assembledMap.get('cake-0')).toBe(true);
  });
});

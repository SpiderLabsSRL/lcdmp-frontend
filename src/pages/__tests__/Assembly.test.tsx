import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { AuthProvider } from '@/contexts/AuthContext';
import Assembly from '../Assembly';
import type { Order } from '@/types';
import type { IAssemblyApi } from '@/api/AssemblyApi';

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

// Order with one line item of every kind, all sitting in 'assembling'.
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
      status: 'assembling',
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      products: [{ id: 'cp-1', productId: 'p1', productName: 'Cupcakes', quantity: 12, pricePerUnit: 5, status: 'assembling' }],
      totalQuantity: 12,
      price: 60,
      details: 'Sin nueces',
    },
  ],
  sweetTableExtras: [
    { id: 'extra-1', productId: 'p2', product: {} as any, productName: 'Galletas', quantity: 20, price: 2, status: 'assembling' },
  ],
  items: [
    { id: 'item-1', productId: 'p3', product: {} as any, productName: 'Pan dulce', quantity: 5, price: 10, notes: 'Sin azúcar', status: 'assembling' },
  ],
  notes: 'Entregar antes de las 3pm',
});

// Order with a single custom cake in 'assembling', for unambiguous dialog interactions.
const singleCakeOrder = makeOrder({
  id: 'order-2',
  orderNumber: 'ORD-002',
  customCakes: [
    {
      id: 'cake-2',
      portions: 18,
      cakeFlavor: 'Vainilla',
      secondCakeFlavor: '',
      fillingFlavor: 'Fresa',
      secondFillingFlavor: 'Manjar',
      referenceImages: [],
      price: 180,
      quantity: 1,
      status: 'assembling',
    },
  ],
});

function buildMockApi(overrides: Partial<IAssemblyApi> = {}): IAssemblyApi {
  return {
    getAssemblyOrders: vi.fn().mockResolvedValue([]),
    updateOrderStatus: vi.fn(),
    completeItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Assembly', () => {
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
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Assembly assemblyApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no work items to assemble', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    expect(await screen.findByText('No hay productos pendientes de armar')).toBeInTheDocument();
    expect(mockApi.getAssemblyOrders).toHaveBeenCalledTimes(1);
  });

  it('renders one card per work item and shows the cake filling as detail', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([fullOrder]) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    const orderNumberBadges = await screen.findAllByText('#ORD-001');
    expect(orderNumberBadges).toHaveLength(4);
    expect(screen.getAllByText('Juana Perez')).toHaveLength(4);

    expect(screen.getByText(/30 porciones - Chocolate/)).toBeInTheDocument();
    expect(screen.getByText(/Relleno: Dulce de leche/)).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 12 Cupcakes')).toBeInTheDocument();
    expect(screen.getByText('Mesa dulce: 20 Galletas')).toBeInTheDocument();
    expect(screen.getByText('Pan dulce')).toBeInTheDocument();
    expect(screen.getAllByText(/Sin azúcar/).length).toBeGreaterThan(0);

    // Stats: 4 pending lines.
    expect(screen.getByText('Pendientes de armar')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('flags items with a pickup less than 12h away as urgent', async () => {
    const soon = new Date();
    const urgentOrder = makeOrder({
      id: 'order-3',
      orderNumber: 'ORD-003',
      pickupDate: soon,
      pickupTime: format(addHours(soon, 3), 'HH:mm'),
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
          status: 'assembling',
        },
      ],
    });
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([urgentOrder]) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await screen.findByText('#ORD-003');
    expect(screen.getByText('Urgentes (<12h)').previousSibling?.textContent).toBe('1');
  });

  it('opens the complete dialog and completes the item, sending it to decoration', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await screen.findByText('#ORD-002');
    await user.click(screen.getByRole('button', { name: /Completar/i }));

    expect(await screen.findByText('Completar Armado')).toBeInTheDocument();
    expect(screen.getByText('Pedido #ORD-002')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enviar a Decoración/i }));

    await waitFor(() => expect(mockApi.completeItem).toHaveBeenCalledWith('order-2', 'custom_cake', 'cake-2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Armado completado, enviado a decoración'));
    expect(screen.queryByText('Completar Armado')).not.toBeInTheDocument();
  });

  it('closes the dialog without completing when Cancelar is clicked', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockResolvedValue([singleCakeOrder]) });
    const user = userEvent.setup();
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await screen.findByText('#ORD-002');
    await user.click(screen.getByRole('button', { name: /Completar/i }));
    expect(await screen.findByText('Completar Armado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Completar Armado')).not.toBeInTheDocument();
    expect(mockApi.completeItem).not.toHaveBeenCalled();
  });

  it('shows an error toast when completing the item fails', async () => {
    const mockApi = buildMockApi({
      getAssemblyOrders: vi.fn().mockResolvedValue([singleCakeOrder]),
      completeItem: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const user = userEvent.setup();
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await screen.findByText('#ORD-002');
    await user.click(screen.getByRole('button', { name: /Completar/i }));
    await user.click(screen.getByRole('button', { name: /Enviar a Decoración/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al completar el armado'));
  });

  it('shows an error toast when loading the initial orders fails', async () => {
    const mockApi = buildMockApi({ getAssemblyOrders: vi.fn().mockRejectedValue(new Error('network down')) });
    renderWithProviders(<Assembly assemblyApi={mockApi} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar los datos'));
    expect(await screen.findByText('No hay productos pendientes de armar')).toBeInTheDocument();
  });
});

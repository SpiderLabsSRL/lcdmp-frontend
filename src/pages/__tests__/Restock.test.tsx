import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Restock from '../Restock';
import type { Order } from '@/types';
import type { IRestockApi } from '@/api/RestockApi';

vi.mock('@/hooks/useOrdersSocket', () => ({
  useOrdersSocket: ({ initialOrders }: any) => ({
    orders: initialOrders,
    setOrders: vi.fn(),
    isConnected: true,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const makeRestockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'restock-1',
  orderNumber: 'ORD-400',
  orderType: 'restock',
  customerName: 'Reposición de stock',
  customerPhone: '',
  pickupDate: new Date(2027, 0, 20),
  pickupTime: '',
  status: 'ready',
  items: [
    { id: 'item-1', productId: 'p1', product: { id: 'p1', name: 'Empanadas' } as any, productName: 'Empanadas', quantity: 20, price: 0 },
  ],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 0,
  total: 0,
  createdAt: new Date(2027, 0, 19, 10, 0),
  createdBy: 'system',
  ...overrides,
});

function buildMockApi(overrides: Partial<IRestockApi> = {}): IRestockApi {
  return {
    getRestockOrders: vi.fn().mockResolvedValue([]),
    confirmRestock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const setNumberValue = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

describe('Restock', () => {
  it('shows a loading state while orders are being fetched', async () => {
    let resolvePromise: (value: Order[]) => void = () => {};
    const pending = new Promise<Order[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getRestockOrders: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Restock restockApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows the empty state when there are no restock tasks ready', async () => {
    const mockApi = buildMockApi({ getRestockOrders: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Restock restockApi={mockApi} />);

    expect(await screen.findByText('No hay reposiciones pendientes de confirmar')).toBeInTheDocument();
  });

  it('renders one card per restock order with the planned quantity and product', async () => {
    const mockApi = buildMockApi({ getRestockOrders: vi.fn().mockResolvedValue([makeRestockOrder()]) });
    renderWithProviders(<Restock restockApi={mockApi} />);

    expect(await screen.findByText('#ORD-400')).toBeInTheDocument();
    expect(screen.getByText('20 Empanadas')).toBeInTheDocument();
  });

  it('opens the confirm dialog pre-filled with the planned quantity, and confirms with an edited actual quantity', async () => {
    const mockApi = buildMockApi({ getRestockOrders: vi.fn().mockResolvedValue([makeRestockOrder()]) });
    const user = userEvent.setup();
    renderWithProviders(<Restock restockApi={mockApi} />);

    await screen.findByText('#ORD-400');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));

    expect(await screen.findByRole('heading', { name: 'Confirmar Reposición' })).toBeInTheDocument();
    const quantityInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(quantityInput).toHaveValue(20);

    setNumberValue(quantityInput, '18');

    await user.click(screen.getByRole('button', { name: /Confirmar y Actualizar Stock/i }));

    await waitFor(() => expect(mockApi.confirmRestock).toHaveBeenCalledWith('restock-1', 'item-1', 18));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Reposición confirmada, stock actualizado'));
  });

  it('shows an error toast when confirming fails', async () => {
    const mockApi = buildMockApi({
      getRestockOrders: vi.fn().mockResolvedValue([makeRestockOrder()]),
      confirmRestock: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const user = userEvent.setup();
    renderWithProviders(<Restock restockApi={mockApi} />);

    await screen.findByText('#ORD-400');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));
    await screen.findByRole('heading', { name: 'Confirmar Reposición' });

    await user.click(screen.getByRole('button', { name: /Confirmar y Actualizar Stock/i }));

    await waitFor(() => expect(mockApi.confirmRestock).toHaveBeenCalled());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al confirmar la reposición'));
  });

  it('closes the dialog without confirming when Cancelar is clicked', async () => {
    const mockApi = buildMockApi({ getRestockOrders: vi.fn().mockResolvedValue([makeRestockOrder()]) });
    const user = userEvent.setup();
    renderWithProviders(<Restock restockApi={mockApi} />);

    await screen.findByText('#ORD-400');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));
    await screen.findByRole('heading', { name: 'Confirmar Reposición' });

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    expect(mockApi.confirmRestock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Confirmar Reposición' })).not.toBeInTheDocument());
  });
});

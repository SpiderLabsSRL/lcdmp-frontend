import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';
import Sales from '../Sales';
import type { Product } from '@/types';
import { ReservationConflictError, type ISalesApi } from '@/api/SalesApi';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const cupcake: Product = {
  id: 'p1',
  name: 'Cupcake de vainilla',
  description: 'Cupcake clásico',
  basePrice: 15,
  category: 'cupcake',
  portionSize: 1,
  pricePerPortion: 15,
  isActive: true,
  stock: 10,
  storeStock: 10,
  productionStock: 0,
  minStock: 2,
};

const cookie: Product = {
  id: 'p2',
  name: 'Galleta de chocolate',
  description: 'Galleta artesanal',
  basePrice: 5,
  category: 'dessert',
  portionSize: 1,
  pricePerPortion: 5,
  isActive: true,
  stock: 20,
  storeStock: 20,
  productionStock: 0,
  minStock: 5,
};

function buildMockApi(overrides: Partial<ISalesApi> = {}): ISalesApi {
  return {
    getProducts: vi.fn().mockResolvedValue([]),
    createSale: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Sales', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows a loading state while products are being fetched', async () => {
    let resolvePromise: (value: Product[]) => void = () => {};
    const pending = new Promise<Product[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getProducts: vi.fn().mockReturnValue(pending) });

    renderWithProviders(<Sales api={mockApi} />);

    expect(screen.getByText('Cargando productos...')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(screen.queryByText('Cargando productos...')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no products and an empty cart', async () => {
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Sales api={mockApi} />);

    expect(await screen.findByText('No se encontraron productos')).toBeInTheDocument();
    expect(screen.getByText('Carrito vacío')).toBeInTheDocument();
  });

  it('renders a populated product catalog', async () => {
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake, cookie]) });
    renderWithProviders(<Sales api={mockApi} />);

    expect(await screen.findByText('Cupcake de vainilla')).toBeInTheDocument();
    expect(screen.getByText('Galleta de chocolate')).toBeInTheDocument();
    expect(screen.getByText('Bs. 15')).toBeInTheDocument();
    expect(screen.getByText('Bs. 5')).toBeInTheDocument();
    expect(screen.getByText('10 u.')).toBeInTheDocument();
    expect(screen.getByText('20 u.')).toBeInTheDocument();
  });

  it('adds items to the cart and updates quantities and the total', async () => {
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake, cookie]) });
    const user = userEvent.setup();
    renderWithProviders(<Sales api={mockApi} />);

    await screen.findByText('Cupcake de vainilla');
    await user.click(screen.getByText('Cupcake de vainilla'));

    expect(await screen.findByText('Subtotal: Bs. 15')).toBeInTheDocument();

    // The product name now appears both in the catalog card and the cart item,
    // so click the catalog card specifically (first match).
    await user.click(screen.getAllByText('Cupcake de vainilla')[0]);

    await waitFor(() => expect(screen.getByText('Subtotal: Bs. 30')).toBeInTheDocument());
    expect(screen.getByText('Bs. 30')).toBeInTheDocument(); // cart total
  });

  it('asks for confirmation when the sale would take reserved stock and retries with overrideReservation', async () => {
    const conflict = {
      productId: 'p1',
      lines: [{ id: 'oi-1', orderId: 'o1', quantity: 1, orderNumber: 'ORD-2026-0042', pickupDate: '2026-10-02', pickupTime: '18:00' }],
    };
    const createSale = vi.fn()
      .mockRejectedValueOnce(new ReservationConflictError('reservado', [conflict]))
      .mockResolvedValueOnce(undefined);
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]), createSale });
    const user = userEvent.setup();
    renderWithProviders(<Sales api={mockApi} />);

    await screen.findByText('Cupcake de vainilla');
    await user.click(screen.getByText('Cupcake de vainilla'));
    await user.click(screen.getByRole('button', { name: 'Cobrar' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar Venta' }));

    expect(await screen.findByText('Stock reservado para pedidos de hoy')).toBeInTheDocument();
    expect(screen.getByText(/ORD-2026-0042/)).toBeInTheDocument();
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(createSale.mock.calls[0][0].overrideReservation).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Vender y mandar a producción' }));

    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(2));
    expect(createSale.mock.calls[1][0].overrideReservation).toBe(true);
  });

  it('shows the product image on the card when it has one, and the cart icon otherwise', async () => {
    const withImage = { ...cupcake, image: 'https://img.example.com/Productos/p1/a.jpg' };
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([withImage, cookie]) });
    renderWithProviders(<Sales api={mockApi} />);

    await screen.findByText('Cupcake de vainilla');

    const image = screen.getByAltText('Cupcake de vainilla');
    expect(image).toHaveAttribute('src', 'https://img.example.com/Productos/p1/a.jpg');
    expect(screen.queryByAltText('Galleta de chocolate')).not.toBeInTheDocument();
  });

  describe('pago mixto', () => {
    const openCheckout = async (user: ReturnType<typeof userEvent.setup>, mockApi: ISalesApi) => {
      renderWithProviders(<Sales api={mockApi} />);
      await screen.findByText('Cupcake de vainilla');
      await user.click(screen.getByText('Cupcake de vainilla'));
      await user.click(screen.getAllByText('Cupcake de vainilla')[0]); // 2 x 15 = Bs. 30 (el carrito repite el nombre)
      await user.click(screen.getByRole('button', { name: 'Cobrar' }));
      await screen.findByText('Completar Venta');
    };
    const cashInput = () => screen.getByLabelText('Monto en efectivo') as HTMLInputElement;
    const confirm = () => screen.getByRole('button', { name: 'Confirmar Venta' });

    it('offers Efectivo, QR and Mixto', async () => {
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]) }));

      expect(screen.getByRole('button', { name: 'Efectivo' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'QR' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mixto' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Monto en efectivo')).not.toBeInTheDocument();
    });

    it('shows the cash input and computes the QR rest as the user types', async () => {
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]) }));

      await user.click(screen.getByRole('button', { name: 'Mixto' }));
      fireEvent.change(cashInput(), { target: { value: '20' } });

      expect(screen.getByTestId('mixed-qr-amount')).toHaveTextContent('Bs. 10');
      expect(screen.getByText(/Escanear para pagar Bs. 10/)).toBeInTheDocument();
    });

    it('cannot confirm until the cash is between 0 and the total, and explains why', async () => {
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]) }));
      await user.click(screen.getByRole('button', { name: 'Mixto' }));

      expect(confirm()).toBeDisabled();
      expect(screen.getByText(/Ingresa cuánto se recibe en efectivo/)).toBeInTheDocument();

      fireEvent.change(cashInput(), { target: { value: '30' } });
      expect(confirm()).toBeDisabled();
      expect(screen.getByText(/usa el método Efectivo/)).toBeInTheDocument();

      fireEvent.change(cashInput(), { target: { value: '12.5' } });
      expect(confirm()).toBeEnabled();
    });

    it('sends the payments breakdown with the "both" method and a success message naming both parts', async () => {
      const createSale = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]), createSale }));
      await user.click(screen.getByRole('button', { name: 'Mixto' }));
      fireEvent.change(cashInput(), { target: { value: '20' } });

      await user.click(confirm());

      await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
      expect(createSale.mock.calls[0][0]).toMatchObject({
        total: 30,
        paymentMethod: 'both',
        payments: [{ method: 'cash', amount: 20 }, { method: 'qr', amount: 10 }],
      });
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
        'Venta completada por Bs. 30 (Efectivo Bs. 20 + QR Bs. 10)'
      ));
    });

    it('a plain cash sale still sends one payment for the whole total', async () => {
      const createSale = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]), createSale }));

      await user.click(confirm());

      await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
      expect(createSale.mock.calls[0][0]).toMatchObject({
        paymentMethod: 'cash', payments: [{ method: 'cash', amount: 30 }],
      });
    });

    it('a QR sale sends one qr payment', async () => {
      const createSale = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]), createSale }));
      await user.click(screen.getByRole('button', { name: 'QR' }));

      await user.click(confirm());

      await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
      expect(createSale.mock.calls[0][0]).toMatchObject({ paymentMethod: 'qr', payments: [{ method: 'qr', amount: 30 }] });
    });

    it('does not keep the cash amount of a previous mixed sale', async () => {
      const createSale = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      await openCheckout(user, buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake]), createSale }));
      await user.click(screen.getByRole('button', { name: 'Mixto' }));
      fireEvent.change(cashInput(), { target: { value: '20' } });
      await user.click(confirm());
      await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));

      // nueva venta: abrir el cobro de nuevo y volver a Mixto
      await user.click((await screen.findAllByText('Cupcake de vainilla'))[0]);
      await user.click(screen.getByRole('button', { name: 'Cobrar' }));
      await screen.findByText('Completar Venta');
      await user.click(screen.getByRole('button', { name: 'Mixto' }));

      expect(cashInput().value).toBe('0');
    });
  });

  it('completes a sale with the cart contents and clears the cart afterward', async () => {
    const mockApi = buildMockApi({ getProducts: vi.fn().mockResolvedValue([cupcake, cookie]) });
    const user = userEvent.setup();
    renderWithProviders(<Sales api={mockApi} />);

    await screen.findByText('Cupcake de vainilla');
    await user.click(screen.getByText('Cupcake de vainilla'));
    await screen.findByText('Subtotal: Bs. 15');

    await user.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByText('Completar Venta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar Venta' }));

    await waitFor(() =>
      expect(mockApi.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 'p1', quantity: 1, price: 15 }],
          total: 15,
          paymentMethod: 'cash',
        })
      )
    );

    await waitFor(() => expect(screen.getByText('Carrito vacío')).toBeInTheDocument());
    expect(mockApi.getProducts).toHaveBeenCalledTimes(2);
  });
});

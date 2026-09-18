import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Sales from '../Sales';
import type { Product } from '@/types';
import type { ISalesApi } from '@/api/SalesApi';

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
  location: 'store',
  stock: 10,
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
  location: 'store',
  stock: 20,
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

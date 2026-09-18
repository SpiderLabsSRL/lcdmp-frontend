import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileBakedProductsGrid } from '../MobileBakedProductsGrid';
import type { BakedProduct } from '@/types';

const products: BakedProduct[] = [
  {
    id: 'b1',
    name: 'Pan integral',
    type: 'bread',
    quantity: 20,
    minStock: 5,
    createdAt: new Date(2026, 0, 1),
  },
  {
    id: 'b2',
    name: 'Cupcake de chocolate',
    type: 'cupcake',
    quantity: 3,
    minStock: 4,
    expiresAt: new Date(2026, 0, 20),
    createdAt: new Date(2026, 0, 1),
  },
];

function getCard(name: string) {
  const heading = screen.getByText(name);
  const card = heading.closest('.rounded-lg');
  if (!card) throw new Error(`Card for ${name} not found`);
  return card as HTMLElement;
}

describe('MobileBakedProductsGrid', () => {
  let onEdit: ReturnType<typeof vi.fn>;
  let onAdjustStock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onEdit = vi.fn();
    onAdjustStock = vi.fn();
  });

  it('renders loading skeleton cards and no product data while loading', () => {
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={true}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.queryByText('Pan integral')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no products', () => {
    render(
      <MobileBakedProductsGrid
        products={[]}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('No hay productos horneados')).toBeInTheDocument();
  });

  it('renders a card per product with name, type label, quantity and min stock', () => {
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('Pan integral')).toBeInTheDocument();
    expect(screen.getByText('Pan')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Stock mínimo: 5')).toBeInTheDocument();

    expect(screen.getByText('Cupcake de chocolate')).toBeInTheDocument();
    expect(screen.getByText('Cupcakes')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the formatted expiration date only when expiresAt is set', () => {
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const expected = `Expira: ${new Date(2026, 0, 20).toLocaleDateString('es')}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('flags low-stock products (quantity <= minStock) but not the others', () => {
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('3').className).toContain('text-destructive');
    expect(screen.getByText('20').className).not.toContain('text-destructive');
  });

  it('calls onEdit with the product when "Editar" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const card = getCard('Pan integral');
    await user.click(within(card).getByRole('button', { name: /editar/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(products[0]);
  });

  it('opens the adjust stock dialog and calls onAdjustStock with the confirmed quantity', async () => {
    const user = userEvent.setup();
    render(
      <MobileBakedProductsGrid
        products={products}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const card = getCard('Pan integral');
    await user.click(within(card).getByRole('button', { name: /agregar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Pan integral')).toBeInTheDocument();

    const confirmButtons = within(dialog).getAllByRole('button', { name: 'Agregar' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(onAdjustStock).toHaveBeenCalledTimes(1);
    expect(onAdjustStock).toHaveBeenCalledWith('b1', 1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileRawMaterialsList } from '../MobileRawMaterialsList';
import type { RawMaterial } from '@/types';

const materials: RawMaterial[] = [
  {
    id: 'm1',
    name: 'Harina',
    unit: 'kg',
    quantity: 50,
    minStock: 10,
    category: 'flour',
    lastUpdated: new Date(2026, 0, 15, 10, 30),
  },
  {
    id: 'm2',
    name: 'Leche',
    unit: 'lt',
    quantity: 5,
    minStock: 10,
    category: 'dairy',
    lastUpdated: new Date(2026, 0, 10, 8, 0),
  },
];

function getCard(name: string) {
  const heading = screen.getByText(name);
  const card = heading.closest('.rounded-lg');
  if (!card) throw new Error(`Card for ${name} not found`);
  return card as HTMLElement;
}

describe('MobileRawMaterialsList', () => {
  let onEdit: ReturnType<typeof vi.fn>;
  let onAdjustStock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onEdit = vi.fn();
    onAdjustStock = vi.fn();
  });

  it('renders loading skeleton cards and no material data while loading', () => {
    render(
      <MobileRawMaterialsList
        materials={materials}
        loading={true}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.queryByText('Harina')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no materials', () => {
    render(
      <MobileRawMaterialsList
        materials={[]}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('No se encontraron materias primas')).toBeInTheDocument();
  });

  it('renders a card per material with name, category label, quantity and min stock', () => {
    render(
      <MobileRawMaterialsList
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('Harina')).toBeInTheDocument();
    expect(screen.getByText('Harinas')).toBeInTheDocument();
    expect(screen.getByText('50 kg')).toBeInTheDocument();
    expect(screen.getByText('10 kg')).toBeInTheDocument();

    expect(screen.getByText('Leche')).toBeInTheDocument();
    expect(screen.getByText('Lácteos')).toBeInTheDocument();
    expect(screen.getByText('5 lt')).toBeInTheDocument();
  });

  it('flags low-stock materials (quantity <= minStock) but not the others', () => {
    render(
      <MobileRawMaterialsList
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('5 lt').className).toContain('text-destructive');
    expect(screen.getByText('50 kg').className).not.toContain('text-destructive');
  });

  it('calls onEdit with the material when "Editar" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MobileRawMaterialsList
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const card = getCard('Harina');
    await user.click(within(card).getByRole('button', { name: /editar/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(materials[0]);
  });

  it('opens the adjust stock dialog and calls onAdjustStock with the confirmed quantity', async () => {
    const user = userEvent.setup();
    render(
      <MobileRawMaterialsList
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const card = getCard('Harina');
    await user.click(within(card).getByRole('button', { name: /agregar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Harina')).toBeInTheDocument();

    const confirmButtons = within(dialog).getAllByRole('button', { name: 'Agregar' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(onAdjustStock).toHaveBeenCalledTimes(1);
    expect(onAdjustStock).toHaveBeenCalledWith('m1', 1);
  });
});

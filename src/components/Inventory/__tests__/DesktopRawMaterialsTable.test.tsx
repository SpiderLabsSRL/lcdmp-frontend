import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesktopRawMaterialsTable } from '../DesktopRawMaterialsTable';
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

function getRow(name: string) {
  const cell = screen.getByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`Row for ${name} not found`);
  return row as HTMLTableRowElement;
}

describe('DesktopRawMaterialsTable', () => {
  let onEdit: ReturnType<typeof vi.fn>;
  let onAdjustStock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onEdit = vi.fn();
    onAdjustStock = vi.fn();
  });

  it('renders a loading skeleton and no table when loading', () => {
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={true}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Harina')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no materials', () => {
    render(
      <DesktopRawMaterialsTable
        materials={[]}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('No se encontraron materias primas')).toBeInTheDocument();
  });

  it('renders a row per material with name, unit, category label and quantity', () => {
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    expect(screen.getByText('Harina')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('Harinas')).toBeInTheDocument();
    expect(screen.getByText('50 kg')).toBeInTheDocument();

    expect(screen.getByText('Leche')).toBeInTheDocument();
    expect(screen.getByText('Lácteos')).toBeInTheDocument();
    expect(screen.getByText('5 lt')).toBeInTheDocument();
  });

  it('visually flags low-stock materials (quantity <= minStock) but not the others', () => {
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const lowStockRow = getRow('Leche');
    const normalRow = getRow('Harina');

    expect(lowStockRow.className).toContain('bg-destructive/5');
    expect(normalRow.className).not.toContain('bg-destructive/5');

    expect(within(lowStockRow).getByText('5 lt').className).toContain('text-destructive');
    expect(within(normalRow).getByText('50 kg').className).not.toContain('text-destructive');
  });

  it('calls onEdit with the material when the edit button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const row = getRow('Harina');
    const buttons = within(row).getAllByRole('button');
    // Second button in the row is the icon-only edit button.
    await user.click(buttons[1]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(materials[0]);
  });

  it('opens the adjust stock dialog and calls onAdjustStock with a positive quantity by default', async () => {
    const user = userEvent.setup();
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const row = getRow('Harina');
    await user.click(within(row).getByRole('button', { name: /agregar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Harina')).toBeInTheDocument();

    const confirmButtons = within(dialog).getAllByRole('button', { name: 'Agregar' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(onAdjustStock).toHaveBeenCalledTimes(1);
    expect(onAdjustStock).toHaveBeenCalledWith('m1', 1);
  });

  it('calls onAdjustStock with a negative quantity when the subtract operation is chosen', async () => {
    const user = userEvent.setup();
    render(
      <DesktopRawMaterialsTable
        materials={materials}
        loading={false}
        onEdit={onEdit}
        onAdjustStock={onAdjustStock}
      />
    );

    const row = getRow('Harina');
    await user.click(within(row).getByRole('button', { name: /agregar/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Restar' }));

    const confirmButtons = within(dialog).getAllByRole('button', { name: 'Restar' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(onAdjustStock).toHaveBeenCalledTimes(1);
    expect(onAdjustStock).toHaveBeenCalledWith('m1', -1);
  });
});

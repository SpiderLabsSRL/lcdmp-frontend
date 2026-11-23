import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryDialogs } from '../InventoryDialogs';
import type { Category, RawMaterial } from '@/types';

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  });
});

const categories: Category[] = [{ id: 'cat-1', name: 'Lácteos', type: 'raw_material' }];

describe('InventoryDialogs', () => {
  const onClose = vi.fn();
  const onSaveRaw = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the RawMaterialForm with the "Nueva Materia Prima" title when creating a raw item', () => {
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
      />,
    );

    expect(screen.getByText('Nueva Materia Prima')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del material')).toBeInTheDocument();
  });

  it('shows the "Editar" title when editingItem is present', () => {
    const editingItem: RawMaterial = {
      id: 'rm-1',
      name: 'Harina',
      unit: 'kg',
      quantity: 1,
      minStock: 1,
      category: 'cat-1',
      lastUpdated: new Date(2026, 0, 1),
    };

    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        editingItem={editingItem}
        categories={categories}
        onSaveRaw={onSaveRaw}
      />,
    );

    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.queryByText('Nueva Materia Prima')).not.toBeInTheDocument();
  });

  it('passes editingItem through to RawMaterialForm so its fields are pre-filled', () => {
    const editingItem: RawMaterial = {
      id: 'rm-1',
      name: 'Harina 000',
      unit: 'kg',
      quantity: 8,
      minStock: 2,
      category: 'cat-1',
      lastUpdated: new Date(2026, 0, 1),
    };

    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        editingItem={editingItem}
        categories={categories}
        onSaveRaw={onSaveRaw}
      />,
    );

    expect(screen.getByPlaceholderText('Nombre del material')).toHaveValue('Harina 000');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('closes the dialog via the nested form Cancelar button', async () => {
    const user = userEvent.setup();
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog content when isOpen is false', () => {
    render(
      <InventoryDialogs
        isOpen={false}
        onClose={onClose}
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
      />,
    );

    expect(screen.queryByText('Nueva Materia Prima')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryDialogs } from '../InventoryDialogs';
import type { BakedProduct, Category, RawMaterial } from '@/types';

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
  const onSaveBaked = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the RawMaterialForm with the "Nueva Materia Prima" title when creating a raw item', () => {
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="raw"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    expect(screen.getByText('Nueva Materia Prima')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del material')).toBeInTheDocument();
  });

  it('renders the BakedProductForm with the "Registrar Productos Horneados" title when creating a baked item', () => {
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="baked"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    expect(screen.getByText('Registrar Productos Horneados')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del producto')).toBeInTheDocument();
  });

  it('shows the "Editar" title regardless of dialogType when editingItem is present', () => {
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
        dialogType="raw"
        editingItem={editingItem}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
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
        dialogType="raw"
        editingItem={editingItem}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    expect(screen.getByPlaceholderText('Nombre del material')).toHaveValue('Harina 000');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('passes editingItem through to BakedProductForm so its fields are pre-filled', () => {
    const editingItem: BakedProduct = {
      id: 'bp-1',
      name: 'Torta de vainilla',
      type: 'cake_base',
      quantity: 2,
      minStock: 1,
      createdAt: new Date(2026, 0, 1),
    };

    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="baked"
        editingItem={editingItem}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    expect(screen.getByPlaceholderText('Nombre del producto')).toHaveValue('Torta de vainilla');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('forwards a raw material submission to onSaveRaw, not onSaveBaked', async () => {
    const user = userEvent.setup();
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="raw"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    await user.type(screen.getByPlaceholderText('Nombre del material'), 'Sal');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(onSaveRaw).toHaveBeenCalledTimes(1);
    expect(onSaveBaked).not.toHaveBeenCalled();
  });

  it('forwards a baked product submission to onSaveBaked, not onSaveRaw', async () => {
    const user = userEvent.setup();
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="baked"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Cupcakes');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(onSaveBaked).toHaveBeenCalledTimes(1);
    expect(onSaveRaw).not.toHaveBeenCalled();
  });

  it('closes the dialog via the nested form Cancelar button', async () => {
    const user = userEvent.setup();
    render(
      <InventoryDialogs
        isOpen
        onClose={onClose}
        dialogType="raw"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
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
        dialogType="raw"
        editingItem={null}
        categories={categories}
        onSaveRaw={onSaveRaw}
        onSaveBaked={onSaveBaked}
      />,
    );

    expect(screen.queryByText('Nueva Materia Prima')).not.toBeInTheDocument();
  });
});

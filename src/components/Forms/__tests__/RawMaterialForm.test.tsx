import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RawMaterialForm } from '../RawMaterialForm';
import type { Category, RawMaterial } from '@/types';

// jsdom does not implement these APIs, but Radix Select relies on them when
// opening/interacting with its portal-rendered content.
beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  });
});

const categories: Category[] = [
  { id: 'cat-1', name: 'Lácteos', type: 'raw_material' },
  { id: 'cat-2', name: 'Harinas', type: 'raw_material' },
];

describe('RawMaterialForm', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty fields and the "Agregar" submit label when creating', () => {
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    expect(screen.getByPlaceholderText('Nombre del material')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  it('pre-fills fields from initialData and shows "Actualizar" when editing', () => {
    const initialData: RawMaterial = {
      id: 'rm-1',
      name: 'Harina 000',
      unit: 'kg',
      quantity: 20,
      minStock: 5,
      category: 'cat-2',
      lastUpdated: new Date(2026, 0, 1),
    };

    render(
      <RawMaterialForm
        initialData={initialData}
        categories={categories}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    expect(screen.getByPlaceholderText('Nombre del material')).toHaveValue('Harina 000');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    // spinbuttons: quantity then minStock
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons[0]).toHaveValue(20);
    expect(spinbuttons[1]).toHaveValue(5);
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits the form data with update=false when creating a new material', async () => {
    const user = userEvent.setup();
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('Nombre del material'), 'Azúcar');

    const spinbuttons = screen.getAllByRole('spinbutton');
    await user.clear(spinbuttons[0]);
    await user.type(spinbuttons[0], '15');
    await user.clear(spinbuttons[1]);
    await user.type(spinbuttons[1], '3');

    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [data, update] = onSave.mock.calls[0];
    expect(update).toBe(false);
    expect(data).toMatchObject({
      name: 'Azúcar',
      unit: 'kg',
      quantity: 15,
      minStock: 3,
      category: '',
    });
  });

  it('submits with update=true and preserves the id when editing', async () => {
    const user = userEvent.setup();
    const initialData: RawMaterial = {
      id: 'rm-2',
      name: 'Mantequilla',
      unit: 'unidad',
      quantity: 4,
      minStock: 1,
      category: 'cat-1',
      lastUpdated: new Date(2026, 0, 1),
    };

    render(
      <RawMaterialForm
        initialData={initialData}
        categories={categories}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [data, update] = onSave.mock.calls[0];
    expect(update).toBe(true);
    expect(data).toMatchObject({
      id: 'rm-2',
      name: 'Mantequilla',
      unit: 'unidad',
      category: 'cat-1',
    });
  });

  it('lets the user pick a category from the dropdown', async () => {
    const user = userEvent.setup();
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]); // Categoría trigger
    const option = await screen.findByRole('option', { name: 'Harinas' });
    await user.click(option);

    await user.type(screen.getByPlaceholderText('Nombre del material'), 'Levadura');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    const [data] = onSave.mock.calls[0];
    expect(data.category).toBe('cat-2');
  });

  it('lets the user pick a unit from the dropdown', async () => {
    const user = userEvent.setup();
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]); // Unidad trigger
    const option = await screen.findByRole('option', { name: 'Litros (L)' });
    await user.click(option);

    await user.type(screen.getByPlaceholderText('Nombre del material'), 'Leche');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    const [data] = onSave.mock.calls[0];
    expect(data.unit).toBe('L');
  });

  it('renders every category option passed in props', async () => {
    const user = userEvent.setup();
    render(<RawMaterialForm categories={categories} onClose={onClose} onSave={onSave} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]);

    expect(await screen.findByRole('option', { name: 'Lácteos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Harinas' })).toBeInTheDocument();
  });
});

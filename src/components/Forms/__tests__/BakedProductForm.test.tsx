import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BakedProductForm } from '../BakedProductForm';
import type { BakedProduct } from '@/types';

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  });
});

describe('BakedProductForm', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty fields and the "Registrar" submit label when creating', () => {
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    expect(screen.getByPlaceholderText('Nombre del producto')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeInTheDocument();
  });

  it('pre-fills fields from initialData and shows "Actualizar" when editing', () => {
    const initialData: BakedProduct = {
      id: 'bp-1',
      name: 'Torta de chocolate',
      type: 'cake_base',
      quantity: 3,
      minStock: 1,
      expiresAt: new Date(2026, 5, 20),
      createdAt: new Date(2026, 0, 1),
    };

    render(<BakedProductForm initialData={initialData} onClose={onClose} onSave={onSave} />);

    expect(screen.getByPlaceholderText('Nombre del producto')).toHaveValue('Torta de chocolate');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons[0]).toHaveValue(3);
    expect(spinbuttons[1]).toHaveValue(1);
    const expectedDateValue = new Date(2026, 5, 20).toISOString().split('T')[0];
    expect(screen.getByDisplayValue(expectedDateValue)).toBeInTheDocument();
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits with update=false and leaves expiresAt undefined when not set', async () => {
    const user = userEvent.setup();
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Cupcakes de vainilla');

    const spinbuttons = screen.getAllByRole('spinbutton');
    await user.clear(spinbuttons[0]);
    await user.type(spinbuttons[0], '12');
    await user.clear(spinbuttons[1]);
    await user.type(spinbuttons[1], '2');

    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [data, update] = onSave.mock.calls[0];
    expect(update).toBe(false);
    expect(data).toMatchObject({
      name: 'Cupcakes de vainilla',
      type: 'cake_base',
      quantity: 12,
      minStock: 2,
    });
    expect(data.expiresAt).toBeUndefined();
  });

  it('submits with update=true, preserving the id, when editing', async () => {
    const user = userEvent.setup();
    const initialData: BakedProduct = {
      id: 'bp-2',
      name: 'Pan de molde',
      type: 'bread',
      quantity: 5,
      minStock: 2,
      createdAt: new Date(2026, 0, 1),
    };

    render(<BakedProductForm initialData={initialData} onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [data, update] = onSave.mock.calls[0];
    expect(update).toBe(true);
    expect(data).toMatchObject({ id: 'bp-2', name: 'Pan de molde', type: 'bread' });
  });

  it('converts a chosen expiration date into a Date object on submit', async () => {
    const user = userEvent.setup();
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Galletas de avena');

    // type="date" inputs are unreliable to drive with user.type across
    // environments; set the value directly and fire a native change event.
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(dateInput, { target: { value: '2026-08-15' } });

    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    const [data] = onSave.mock.calls[0];
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect((data.expiresAt as Date).toISOString().split('T')[0]).toBe('2026-08-15');
  });

  it('lets the user pick a product type from the dropdown', async () => {
    const user = userEvent.setup();
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'Galletas' });
    await user.click(option);

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Galletas de mantequilla');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    const [data] = onSave.mock.calls[0];
    expect(data.type).toBe('cookie');
  });

  it('renders all product type options', async () => {
    const user = userEvent.setup();
    render(<BakedProductForm onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('combobox'));

    for (const label of ['Base de torta', 'Cupcakes', 'Galletas', 'Pan', 'Pastelería']) {
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument();
    }
  });
});

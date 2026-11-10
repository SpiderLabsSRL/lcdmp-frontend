import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';
import { ExpressOrderDialog } from '../ExpressOrderDialog';
import type { CartItem } from '@/types';

const items: CartItem[] = [
  { productId: 'p1', name: 'Cupcake', quantity: 2, price: 15 },
  { productId: 'p2', name: 'Brownie', quantity: 1, price: 10 },
]; // 40

function setup(overrides: { onSubmit?: ReturnType<typeof vi.fn>; items?: CartItem[] } = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const utils = render(
    <ExpressOrderDialog open onOpenChange={onOpenChange} items={overrides.items ?? items} onSubmit={onSubmit} />
  );
  return { onSubmit, onOpenChange, ...utils };
}

const total = () => screen.getByTestId('express-total');
const balance = () => screen.getByTestId('express-balance');
const submit = () => screen.getByRole('button', { name: 'Crear pedido' });

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/A nombre de/), 'Ana Pérez');
  await user.click(screen.getByRole('button', { name: 'Moto' }));
}

describe('ExpressOrderDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the cart products and charges everything by default', () => {
    setup();

    expect(screen.getByText('2 × Cupcake')).toBeInTheDocument();
    expect(screen.getByText('1 × Brownie')).toBeInTheDocument();
    expect(total()).toHaveTextContent('Bs. 40.00');
    expect(screen.getByLabelText(/Paga ahora/)).toHaveValue(40);
    expect(balance()).toHaveTextContent('Bs. 0.00');
  });

  it('offers móvil, moto and personal, and none is preselected', () => {
    setup();

    for (const label of ['Móvil', 'Moto', 'Personal']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('requires the name and how it is picked up', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.click(submit());
    expect(toast.error).toHaveBeenLastCalledWith('Indica a nombre de quién va el pedido');

    await user.type(screen.getByLabelText(/A nombre de/), 'Ana');
    await user.click(submit());
    expect(toast.error).toHaveBeenLastCalledWith('Indica cómo lo recoge: móvil, moto o personal');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the order with the defaults: reserves stock, no shipping, pays everything in cash', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillBasics(user);
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      recipientName: 'Ana Pérez',
      pickupMethod: 'motorcycle',
      customerPhone: undefined,
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      deductStock: true,
      shippingCost: undefined,
      deposit: 40,
      paymentMethod: 'cash',
      dedication: undefined,
      notes: undefined,
    });
  });

  it('adds the shipping to the total only when the customer pays it', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.click(screen.getByLabelText(/Envío Pagado/));
    fireEvent.change(screen.getByLabelText(/Costo del envío/), { target: { value: '12' } });

    expect(total()).toHaveTextContent('Bs. 52.00');
    expect(screen.getByLabelText(/Paga ahora/)).toHaveValue(52);

    await fillBasics(user);
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ shippingCost: 12, deposit: 52 });
  });

  it('requires the shipping cost once "Envío Pagado" is checked', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillBasics(user);
    await user.click(screen.getByLabelText(/Envío Pagado/));
    await user.click(submit());

    expect(toast.error).toHaveBeenLastCalledWith('Indica el costo del envío o desmarca "Envío Pagado"');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets the customer pay only part now and shows the balance due on delivery', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    fireEvent.change(screen.getByLabelText(/Paga ahora/), { target: { value: '15' } });
    expect(balance()).toHaveTextContent('Bs. 25.00');

    await user.click(screen.getByRole('button', { name: /QR/ }));
    await fillBasics(user);
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ deposit: 15, paymentMethod: 'qr' });
  });

  it('paying 0 now leaves everything for the delivery and hides the payment method', () => {
    setup();

    fireEvent.change(screen.getByLabelText(/Paga ahora/), { target: { value: '0' } });

    expect(screen.getByLabelText(/Paga ahora/)).toHaveValue(0);
    expect(balance()).toHaveTextContent('Bs. 40.00');
    expect(screen.queryByRole('button', { name: /Efectivo/ })).not.toBeInTheDocument();
  });

  it('cannot pay more than the total', () => {
    setup();

    fireEvent.change(screen.getByLabelText(/Paga ahora/), { target: { value: '500' } });

    expect(screen.getByLabelText(/Paga ahora/)).toHaveValue(40);
  });

  it('"Descontar de stock" is checked by default and explains what each choice does', async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByLabelText('Descontar de stock')).toBeChecked();
    expect(screen.getByText(/Reserva las unidades en tienda ahora/)).toBeInTheDocument();

    await user.click(screen.getByLabelText('Descontar de stock'));
    expect(screen.getByText(/No toca el stock/)).toBeInTheDocument();
  });

  it('sends deductStock=false when unchecked', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillBasics(user);
    await user.click(screen.getByLabelText('Descontar de stock'));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].deductStock).toBe(false);
  });

  it('personalizes a line: its surcharge per unit goes into the total and into the payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.click(screen.getByLabelText('Personalizar Cupcake'));
    await user.type(screen.getByLabelText('Personalización de Cupcake'), 'Nombre en cada uno');
    fireEvent.change(screen.getByLabelText('Recargo de Cupcake'), { target: { value: '5' } });

    // (15 + 5) x 2 + 10 = 50
    expect(total()).toHaveTextContent('Bs. 50.00');

    await fillBasics(user);
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].items[0]).toEqual({
      productId: 'p1', quantity: 2, customizationNotes: 'Nombre en cada uno', customizationPrice: 5,
    });
    expect(onSubmit.mock.calls[0][0].items[1]).toEqual({ productId: 'p2', quantity: 1 });
  });

  it('requires describing a personalization that was checked', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillBasics(user);
    await user.click(screen.getByLabelText('Personalizar Brownie'));
    await user.click(submit());

    expect(toast.error).toHaveBeenLastCalledWith('Describe la personalización de "Brownie" o desmárcala');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the optional phone (digits only), dedication and notes', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await fillBasics(user);
    await user.type(screen.getByLabelText(/Teléfono/), '+591 7001-1122');
    await user.type(screen.getByLabelText(/Dedicatoria/), '  Feliz cumple  ');
    await user.type(screen.getByLabelText(/Notas/), 'Sin velas');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      customerPhone: '59170011122', dedication: 'Feliz cumple', notes: 'Sin velas',
    });
  });

  it('shows the server error and stays open when the order cannot be created', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Stock insuficiente en tienda'));
    const { onOpenChange } = setup({ onSubmit });

    await fillBasics(user);
    await user.click(submit());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Stock insuficiente en tienda'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(submit()).not.toBeDisabled();
  });
});

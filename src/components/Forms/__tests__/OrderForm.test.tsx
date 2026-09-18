import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
import OrderForm from '../OrderForm';
import type { Product, Flavor, SweetTableCombo, Order } from '@/types';
import { getLocalDateString } from '@/utils/DateUtils';

const mockedToastError = toast.error as unknown as ReturnType<typeof vi.fn>;

// jsdom does not implement these APIs, but Radix Select relies on them when
// opening/interacting with its portal-rendered content.
beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  });
});

const products: Product[] = [
  {
    id: 'p1',
    name: 'Cupcake Vainilla',
    description: 'Cupcake individual de vainilla',
    basePrice: 15,
    category: 'cupcake',
    portionSize: 1,
    pricePerPortion: 15,
    isActive: true,
    location: 'store',
    stock: 100,
    minStock: 5,
  },
  {
    id: 'p2',
    name: 'Brownie',
    description: 'Brownie de chocolate',
    basePrice: 10,
    category: 'dessert',
    portionSize: 1,
    pricePerPortion: 10,
    isActive: true,
    location: 'store',
    stock: 100,
    minStock: 5,
  },
  {
    id: 'p3',
    name: 'Galleta',
    description: 'Galleta decorada',
    basePrice: 5,
    category: 'dessert',
    portionSize: 1,
    pricePerPortion: 5,
    isActive: true,
    location: 'store',
    stock: 100,
    minStock: 5,
  },
];

const flavors: Flavor[] = [
  { id: 'f1', name: 'Chocolate', type: 'cake', isActive: true },
  { id: 'f2', name: 'Vainilla', type: 'cake', isActive: true },
  { id: 'f3', name: 'Dulce de Leche', type: 'filling', isActive: true },
  { id: 'f4', name: 'Frutilla', type: 'filling', isActive: true },
];

const sweetTableCombos: SweetTableCombo[] = [
  {
    id: 'combo1',
    name: 'Mesa Dulce 50',
    totalQuantity: 20,
    fixedPrice: 400,
    price: 400,
    isPreset: true,
    isActive: true,
    products: [
      { productId: 'p1', productName: 'Cupcake Vainilla', quantity: 10, pricePerUnit: 15 },
      { productId: 'p2', productName: 'Brownie', quantity: 10, pricePerUnit: 10 },
    ],
  },
  {
    id: 'combo2',
    name: 'Mesa Dulce 30',
    totalQuantity: 15,
    fixedPrice: 250,
    price: 250,
    isPreset: true,
    isActive: true,
    products: [{ productId: 'p3', productName: 'Galleta', quantity: 15, pricePerUnit: 5 }],
  },
];

function renderForm(overrides: Partial<React.ComponentProps<typeof OrderForm>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <OrderForm
      onSubmit={onSubmit}
      onClose={onClose}
      products={products}
      flavors={flavors}
      sweetTableCombos={sweetTableCombos}
      {...overrides}
    />,
  );
  return { onSubmit, onClose, ...utils };
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  optionName: string | RegExp,
) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name: optionName });
  await user.click(option);
}

// Driving number inputs with user.clear()/type() is unreliable here: several
// of them are bound to `value={x || fallback}`, so the instant the field
// becomes empty mid-keystroke it snaps back to the fallback (NaN is falsy),
// producing stray leading digits (clearing quantity=1 bounces to "1" before
// "2" lands, yielding "12"). Setting the value directly via a native change
// event sidesteps that entirely.
function setNumberValue(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function getTotalsRow(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

function getMesaDulceSection(): HTMLElement {
  return screen.getByRole('heading', { name: 'Mesa Dulce' }).closest('.p-4') as HTMLElement;
}

// Radix's combobox trigger does not expose an accessible name from its
// rendered placeholder text (role="combobox" is not in the ARIA
// "name from content" list), so these are looked up by DOM position instead.
function getPresetComboSelect(): HTMLElement {
  return within(getMesaDulceSection()).getAllByRole('combobox')[0];
}

async function fillRequiredCustomerFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Nombre completo'), 'Maria Lopez');
  await user.type(screen.getByPlaceholderText('Número de teléfono'), '71234567');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderForm - initial render (create mode)', () => {
  it('renders empty required fields and the "Crear Pedido" submit label', () => {
    renderForm();

    expect(screen.getByPlaceholderText('Nombre completo')).toHaveValue('');
    expect(screen.getByPlaceholderText('Número de teléfono')).toHaveValue('');

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe(getLocalDateString());

    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    expect(timeInput.value).toBe('12:00');

    expect(within(getTotalsRow('Subtotal:')).getByText('Bs. 0.00')).toBeInTheDocument();
    expect(within(getTotalsRow('Total a pagar:')).getByText('Bs. 0.00')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Crear Pedido' })).toBeInTheDocument();

    expect(screen.getByLabelText('Torta personalizada')).not.toBeChecked();
    expect(screen.getByLabelText('Productos del catálogo')).not.toBeChecked();
    expect(screen.getByLabelText('Mesa dulce')).not.toBeChecked();

    // No product-type section is shown until an option is selected.
    expect(screen.queryByText('Tortas Personalizadas')).not.toBeInTheDocument();
    expect(screen.queryByText('Productos del Catálogo')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesa Dulce')).not.toBeInTheDocument();
  });

  it('shows the "Actualizar Pedido" submit label when isEditing is true', () => {
    renderForm({ isEditing: true });
    expect(screen.getByRole('button', { name: 'Actualizar Pedido' })).toBeInTheDocument();
  });
});

describe('OrderForm - custom cakes', () => {
  it('adds a custom cake and updates the subtotal as fields are filled', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Torta personalizada'));

    expect(screen.getByText('Torta #1')).toBeInTheDocument();
    const card = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    expect(card).toBeTruthy();

    // combobox order inside the card: portions, shape, cakeFlavor, fillingFlavor,
    // secondCakeFlavor, secondFillingFlavor
    const comboboxes = within(card).getAllByRole('combobox');
    expect(comboboxes).toHaveLength(6);
    expect(comboboxes[0]).toHaveTextContent('15 porciones');

    await chooseOption(user, comboboxes[2], 'Chocolate');
    await chooseOption(user, comboboxes[3], 'Dulce de Leche');

    // spinbutton order inside the card: quantity, then price
    const spinbuttons = within(card).getAllByRole('spinbutton');
    setNumberValue(spinbuttons[0], '2');

    const priceInput = within(card).getByPlaceholderText('0');
    setNumberValue(priceInput, '300');

    expect(within(getTotalsRow('Subtotal:')).getByText('Bs. 600.00')).toBeInTheDocument();
  });

  it('removes a cake when more than one is present', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Torta personalizada'));
    await user.click(screen.getByRole('button', { name: /Agregar Torta/i }));

    expect(screen.getByText('Torta #1')).toBeInTheDocument();
    expect(screen.getByText('Torta #2')).toBeInTheDocument();

    const secondCard = screen.getByText('Torta #2').closest('.relative') as HTMLElement;
    await user.click(within(secondCard).getByRole('button'));

    expect(screen.queryByText('Torta #2')).not.toBeInTheDocument();
    expect(screen.getByText('Torta #1')).toBeInTheDocument();
  });
});

describe('OrderForm - catalog products', () => {
  it('adds a catalog item, selects a product and updates the quantity/subtotal', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Productos del catálogo'));

    expect(screen.getByText('Producto #1')).toBeInTheDocument();
    const card = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;

    const productSelect = within(card).getByRole('combobox');
    await chooseOption(user, productSelect, /Cupcake Vainilla - Bs\. 15/);

    const quantityInput = within(card).getByRole('spinbutton');
    setNumberValue(quantityInput, '3');

    expect(within(getTotalsRow('Subtotal:')).getByText('Bs. 45.00')).toBeInTheDocument();
  });
});

describe('OrderForm - sweet table combos', () => {
  it('seeds a combo from the preset dropdown with the right totalQuantity, price and products', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Mesa dulce'));

    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);

    expect(screen.getByText('Mesa Dulce 50')).toBeInTheDocument();
    expect(screen.getByText(/Precio fijo: Bs\. 400/)).toBeInTheDocument();
    expect(screen.getByText(/Total: 20 \/ 20 porciones/)).toBeInTheDocument();

    const comboCard = screen.getByText('Mesa Dulce 50').closest('.p-3') as HTMLElement;
    const productSelects = within(comboCard).getAllByRole('combobox');
    expect(productSelects).toHaveLength(2);
    expect(productSelects[0]).toHaveTextContent('Cupcake Vainilla');
    expect(productSelects[1]).toHaveTextContent('Brownie');

    const quantityInputs = within(comboCard).getAllByRole('spinbutton');
    expect(quantityInputs[0]).toHaveValue(10);
    expect(quantityInputs[1]).toHaveValue(10);
  });

  it('lets the quantity sum go out of sync and shows the mismatch indicator', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Mesa dulce'));
    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);

    const comboCard = screen.getByText('Mesa Dulce 50').closest('.p-3') as HTMLElement;
    const quantityInputs = within(comboCard).getAllByRole('spinbutton');
    setNumberValue(quantityInputs[0], '5');

    expect(within(comboCard).getByText(/Total: 15 \/ 20 porciones/)).toBeInTheDocument();
    expect(within(comboCard).getByText(/debe coincidir exactamente/)).toBeInTheDocument();
  });

  it('swaps a product in a seeded combo, updates its price per unit and keeps the combo price fixed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByLabelText('Mesa dulce'));
    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);

    expect(screen.getByText(/Precio fijo: Bs\. 400/)).toBeInTheDocument();

    const comboCard = screen.getByText('Mesa Dulce 50').closest('.p-3') as HTMLElement;
    const productSelects = within(comboCard).getAllByRole('combobox');

    // Swap the first product line (Cupcake Vainilla, qty 10) for Galleta.
    // Quantity is untouched by the swap, so the sum (10 + 10 = 20) stays valid.
    await chooseOption(user, productSelects[0], 'Galleta');

    // The fixed combo price must not recompute after the product swap.
    expect(screen.getByText(/Precio fijo: Bs\. 400/)).toBeInTheDocument();
    expect(within(comboCard).getByText(/Total: 20 \/ 20 porciones/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.sweetTableCombos[0].price).toBe(400);
    expect(submitted.sweetTableCombos[0].products[0]).toMatchObject({
      productId: 'p3',
      pricePerUnit: 5,
      quantity: 10,
    });
    expect(submitted.sweetTableCombos[0].products[1]).toMatchObject({
      productId: 'p2',
      pricePerUnit: 10,
      quantity: 10,
    });
  });
});

describe('OrderForm - sweet table extras', () => {
  it('adds and removes a sweet table extra', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Mesa dulce'));

    expect(screen.getByText('Sin postres adicionales. Estos se agregan por separado de las mesas dulces.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agregar postre/i }));

    expect(
      screen.queryByText('Sin postres adicionales. Estos se agregan por separado de las mesas dulces.'),
    ).not.toBeInTheDocument();

    // Only the preset dropdown (index 0) precedes the newly added extra row's
    // product select (index 1) since no combo has been added in this test.
    const extraSelect = within(getMesaDulceSection()).getAllByRole('combobox')[1];
    await chooseOption(user, extraSelect, /Galleta - Bs\. 5/);

    const extraRow = extraSelect.closest('.items-end') as HTMLElement;
    const quantityInput = within(extraRow).getByRole('spinbutton');
    setNumberValue(quantityInput, '4');

    expect(within(extraRow).getByText('Bs. 20.00')).toBeInTheDocument();
    expect(screen.getByText(/Total adicionales: Bs\. 20\.00/)).toBeInTheDocument();

    const removeButton = within(extraRow).getByRole('button');
    await user.click(removeButton);

    expect(screen.getByText('Sin postres adicionales. Estos se agregan por separado de las mesas dulces.')).toBeInTheDocument();
  });
});

describe('OrderForm - submit validation', () => {
  it('blocks submit and shows an error when required customer fields are missing', () => {
    const { onSubmit } = renderForm();

    // customerName/customerPhone are empty, which the native "required"
    // attribute would itself block via a button click before React's
    // onSubmit ever runs. Dispatching "submit" directly on the form exercises
    // the component's own JS-level validation instead.
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(mockedToastError).toHaveBeenCalledWith('Por favor complete todos los campos requeridos');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an error when no product type is selected', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(mockedToastError).toHaveBeenCalledWith('Debe seleccionar al menos un tipo de producto');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit when a combo quantity sum does not match its totalQuantity', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByLabelText('Mesa dulce'));
    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);

    const comboCard = screen.getByText('Mesa Dulce 50').closest('.p-3') as HTMLElement;
    const quantityInputs = within(comboCard).getAllByRole('spinbutton');
    setNumberValue(quantityInputs[0], '5');

    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(mockedToastError).toHaveBeenCalledWith(
      expect.stringContaining('debe sumar exactamente 20 porciones (actualmente suma 15)'),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('OrderForm - happy path submit', () => {
  it('submits a correctly-shaped payload for a simple catalog-item order', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByLabelText('Productos del catálogo'));

    const card = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;
    const productSelect = within(card).getByRole('combobox');
    await chooseOption(user, productSelect, /Cupcake Vainilla - Bs\. 15/);

    const quantityInput = within(card).getByRole('spinbutton');
    setNumberValue(quantityInput, '2');

    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(mockedToastError).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.customerName).toBe('Maria Lopez');
    expect(submitted.customerPhone).toBe('71234567');
    expect(submitted.orderType).toBe('products');
    expect(submitted.items).toHaveLength(1);
    expect(submitted.items[0]).toMatchObject({ productId: 'p1', quantity: 2, price: 15 });
    expect(submitted.total).toBe(30);
  });

  it('marks the order as "mixed" when more than one product type is selected', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByLabelText('Torta personalizada'));
    await user.click(screen.getByLabelText('Productos del catálogo'));

    const cakeCard = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    const cakeCombos = within(cakeCard).getAllByRole('combobox');
    await chooseOption(user, cakeCombos[2], 'Chocolate');
    await chooseOption(user, cakeCombos[3], 'Dulce de Leche');
    const cakePriceInput = within(cakeCard).getByPlaceholderText('0');
    setNumberValue(cakePriceInput, '200');

    const productCard = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;
    const productSelect = within(productCard).getByRole('combobox');
    await chooseOption(user, productSelect, /Brownie - Bs\. 10/);

    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.orderType).toBe('mixed');
  });
});

describe('OrderForm - editing an existing order', () => {
  const existingOrder: Order = {
    id: 'o1',
    orderNumber: 'ORD-100',
    orderType: 'mixed',
    customerName: 'Juana Perez',
    customerPhone: '70011122',
    pickupDate: new Date(2026, 9, 10),
    pickupTime: '15:30',
    status: 'pending',
    items: [{ productId: 'p2', product: products[1], quantity: 2, price: 10 }],
    customCakes: [
      {
        id: 'cake-1',
        portions: 20,
        shape: 'redonda',
        cakeFlavor: 'Chocolate',
        secondCakeFlavor: '',
        fillingFlavor: 'Dulce de Leche',
        secondFillingFlavor: '',
        design: 'Tema safari',
        dedication: 'Feliz cumple',
        referenceImages: [],
        price: 250,
        quantity: 1,
      },
    ],
    sweetTableCombos: [
      {
        comboId: 'combo1',
        name: 'Mesa Dulce 50',
        totalQuantity: 20,
        price: 400,
        details: '',
        products: [
          { productId: 'p1', productName: 'Cupcake Vainilla', quantity: 10, pricePerUnit: 15 },
          { productId: 'p2', productName: 'Brownie', quantity: 10, pricePerUnit: 10 },
        ],
      },
    ],
    sweetTableExtras: [{ productId: 'p3', product: products[2], quantity: 4, price: 5 }],
    deliveryAddress: 'Av. Siempre Viva 123',
    deliveryCost: 20,
    deposit: 100,
    depositMethod: 'cash',
    total: 0,
    discount: 10,
    notes: 'Entregar en la tarde',
    createdAt: new Date(2026, 8, 1),
    createdBy: 'user-1',
  };

  it('pre-fills the form from initialData', () => {
    renderForm({ initialData: existingOrder, isEditing: true });

    expect(screen.getByPlaceholderText('Nombre completo')).toHaveValue('Juana Perez');
    expect(screen.getByPlaceholderText('Número de teléfono')).toHaveValue('70011122');

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-10-10');
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    expect(timeInput.value).toBe('15:30');

    // Cake section pre-filled
    const cakeCard = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    expect(within(cakeCard).getByDisplayValue('Tema safari')).toBeInTheDocument();
    expect(within(cakeCard).getByDisplayValue('Feliz cumple')).toBeInTheDocument();
    expect(within(cakeCard).getByPlaceholderText('0')).toHaveValue(250);

    // Catalog product pre-filled
    const productCard = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;
    expect(within(productCard).getByRole('spinbutton')).toHaveValue(2);

    // Sweet table combo pre-filled and valid
    expect(screen.getByText('Mesa Dulce 50')).toBeInTheDocument();
    expect(screen.getByText(/Total: 20 \/ 20 porciones/)).toBeInTheDocument();

    // Sweet table extra pre-filled
    expect(screen.getByDisplayValue('Entregar en la tarde')).toBeInTheDocument();

    // Delivery / payment / discount
    expect(screen.getByDisplayValue('Av. Siempre Viva 123')).toBeInTheDocument();

    const submitLabel = screen.getByRole('button', { name: 'Actualizar Pedido' });
    expect(submitLabel).toBeInTheDocument();
  });

  it('submits the edited payload keeping the pre-filled values intact', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initialData: existingOrder, isEditing: true });

    await user.click(screen.getByRole('button', { name: 'Actualizar Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.customerName).toBe('Juana Perez');
    expect(submitted.sweetTableExtras[0]).toMatchObject({ productId: 'p3', quantity: 4, price: 5 });
    expect(submitted.deliveryAddress).toBe('Av. Siempre Viva 123');
    expect(submitted.discount).toBe(10);
  });
});

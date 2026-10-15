import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
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
    stock: 100,
    storeStock: 100,
    productionStock: 0,
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
    stock: 100,
    storeStock: 100,
    productionStock: 0,
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
    stock: 100,
    storeStock: 100,
    productionStock: 0,
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

    expect(screen.getByRole('button', { name: '12:00' })).toBeInTheDocument();

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

  // Regression test for a reported bug: clearing a number field and typing a
  // new digit produced "12" instead of "2" (the field would snap back to its
  // fallback value mid-edit). Drives the input with realistic keystrokes
  // (user.clear + user.type) instead of the setNumberValue() workaround used
  // elsewhere in this file, to prove the actual browser interaction works.
  it('lets the cake quantity be cleared and retyped with real keystrokes without concatenating digits', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Torta personalizada'));
    const card = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    const quantityInput = within(card).getAllByRole('spinbutton')[0] as HTMLInputElement;

    expect(quantityInput).toHaveValue(1);

    await user.clear(quantityInput);
    expect(quantityInput.value).toBe('');

    await user.type(quantityInput, '2');

    expect(quantityInput).toHaveValue(2);
  });

  it('lets the cake price be cleared without snapping back to 0 mid-edit, and typing "1" never leaves a leading zero', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Torta personalizada'));
    const card = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    const priceInput = within(card).getByPlaceholderText('0') as HTMLInputElement;

    await user.clear(priceInput);
    expect(priceInput.value).toBe('');

    await user.type(priceInput, '1');

    expect(priceInput).toHaveValue(1);
    expect(priceInput.value).not.toBe('01');
  });

  it('removes a cake when more than one is present', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Torta personalizada'));
    await user.click(screen.getByRole('button', { name: /Agregar Torta/i }));

    expect(screen.getByText('Torta #1')).toBeInTheDocument();
    expect(screen.getByText('Torta #2')).toBeInTheDocument();

    const secondCard = screen.getByText('Torta #2').closest('.relative') as HTMLElement;
    await user.click(within(secondCard).getByRole('button', { name: 'Quitar torta' }));

    expect(screen.queryByText('Torta #2')).not.toBeInTheDocument();
    expect(screen.getByText('Torta #1')).toBeInTheDocument();
  });
});

describe('OrderForm - porciones de torta', () => {
  const openCake = async (user: ReturnType<typeof userEvent.setup>) => {
    renderForm();
    await user.click(screen.getByLabelText('Torta personalizada'));
    const card = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    return { card, portions: within(card).getAllByRole('combobox')[0] };
  };

  it('offers only the common sizes plus "Otra cantidad..."', async () => {
    const user = userEvent.setup();
    const { portions } = await openCake(user);

    await user.click(portions);

    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual([
      '10 porciones', '15 porciones', '20 porciones', '30 porciones', '40 porciones', '50 porciones', 'Otra cantidad...',
    ]);
  });

  it('selects a preset', async () => {
    const user = userEvent.setup();
    const { portions } = await openCake(user);

    await chooseOption(user, portions, '40 porciones');

    expect(portions).toHaveTextContent('40 porciones');
  });

  it('lets the user type any other number of portions with "Otra cantidad"', async () => {
    const user = userEvent.setup();
    const { card, portions } = await openCake(user);

    await chooseOption(user, portions, 'Otra cantidad...');
    const custom = within(card).getByLabelText('Porciones personalizadas');
    setNumberValue(custom, '250');

    expect(custom).toHaveValue(250);
    expect(portions).toHaveTextContent('Otra cantidad...');
  });

  it('hides the custom input again when a preset is chosen', async () => {
    const user = userEvent.setup();
    const { card, portions } = await openCake(user);

    await chooseOption(user, portions, 'Otra cantidad...');
    await chooseOption(user, portions, '20 porciones');

    expect(within(card).queryByLabelText('Porciones personalizadas')).not.toBeInTheDocument();
  });
});

describe('OrderForm - forma de torta', () => {
  it('offers "Long cake" among the shapes and submits it as the long-cake value', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByLabelText('Torta personalizada'));
    const card = screen.getByText('Torta #1').closest('.relative') as HTMLElement;
    const comboboxes = within(card).getAllByRole('combobox');

    // orden: porciones, forma, sabor de torta, relleno, ...
    await user.click(comboboxes[1]);
    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual(['Redonda', 'Cuadrada', 'Rectangular', 'Long cake', 'Corazón', 'Dos pisos', 'Tres pisos']);
    await user.click(screen.getByRole('option', { name: 'Long cake' }));
    expect(comboboxes[1]).toHaveTextContent('Long cake');

    await chooseOption(user, comboboxes[2], 'Chocolate');
    await chooseOption(user, comboboxes[3], 'Dulce de Leche');
    setNumberValue(within(card).getAllByRole('spinbutton')[1], '100');
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].customCakes[0].shape).toBe('long-cake');
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

describe('OrderForm - usar de stock', () => {
  it('offers the "Usar de stock" check once a product is chosen and sends fromStock in the payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText('Productos del catálogo'));
    const card = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;
    expect(within(card).queryByLabelText(/Usar de stock/)).not.toBeInTheDocument();

    await chooseOption(user, within(card).getByRole('combobox'), /Cupcake Vainilla - Bs\. 15/);
    expect(within(card).getByText(/disponible en tienda: 100/)).toBeInTheDocument();

    await user.click(within(card).getByLabelText(/Usar de stock/));
    expect(within(card).getByText(/Queda lista de inmediato/)).toBeInTheDocument();

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].items[0].fromStock).toBe(true);
  });
});

describe('OrderForm - producto de catálogo personalizado', () => {
  const addCatalogLine = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByLabelText('Productos del catálogo'));
    const card = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;
    await chooseOption(user, within(card).getByRole('combobox'), /Cupcake Vainilla - Bs\. 15/);
    return card;
  };

  it('offers "Personalizado" only after a product is chosen, and it starts closed', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText('Productos del catálogo'));
    const card = screen.getByText('Producto #1').closest('.space-y-3') as HTMLElement;

    expect(within(card).queryByLabelText(/Personalizado/)).not.toBeInTheDocument();

    await chooseOption(user, within(card).getByRole('combobox'), /Cupcake Vainilla - Bs\. 15/);

    expect(within(card).getByLabelText(/Personalizado/)).not.toBeChecked();
    expect(within(card).queryByText('Qué se personaliza *')).not.toBeInTheDocument();
  });

  it('adds the per-unit surcharge to the line and to the subtotal: (15 + 5) x 3 = 60', async () => {
    const user = userEvent.setup();
    renderForm();
    const card = await addCatalogLine(user);
    setNumberValue(within(card).getByRole('spinbutton'), '3');

    await user.click(within(card).getByLabelText(/Personalizado/));
    await user.type(within(card).getByPlaceholderText(/Papel comestible/), 'Papel comestible con foto');
    setNumberValue(within(card).getAllByRole('spinbutton')[1], '5');

    expect(within(card).getByText(/Bs\. 60\.00/)).toBeInTheDocument();
    expect(within(getTotalsRow('Subtotal:')).getByText('Bs. 60.00')).toBeInTheDocument();
  });

  it('sends the customization in the payload, with the description trimmed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const card = await addCatalogLine(user);

    await user.click(within(card).getByLabelText(/Personalizado/));
    await user.type(within(card).getByPlaceholderText(/Papel comestible/), '  Foto de Leo  ');
    setNumberValue(within(card).getAllByRole('spinbutton')[1], '25');
    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({
      productId: 'p1', price: 15, customizationNotes: 'Foto de Leo', customizationPrice: 25, referenceImages: [],
    });
    expect(onSubmit.mock.calls[0][0].total).toBe(40);
  });

  it('blocks the submit with a message when "Personalizado" is on but nothing is described', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const card = await addCatalogLine(user);

    await user.click(within(card).getByLabelText(/Personalizado/));
    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockedToastError).toHaveBeenCalledWith(expect.stringContaining('Describe la personalización'));
  });

  it('turning "Personalizado" off drops the surcharge and the fields from the payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const card = await addCatalogLine(user);

    await user.click(within(card).getByLabelText(/Personalizado/));
    await user.type(within(card).getByPlaceholderText(/Papel comestible/), 'Foto');
    setNumberValue(within(card).getAllByRole('spinbutton')[1], '25');
    await user.click(within(card).getByLabelText(/Personalizado/)); // apagar
    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    const item = onSubmit.mock.calls[0][0].items[0];
    expect(item.customizationNotes).toBeUndefined();
    expect(item.customizationPrice).toBeUndefined();
    expect(onSubmit.mock.calls[0][0].total).toBe(15);
  });

  it('tells the user a customized stock line goes to Decoración instead of being ready', async () => {
    const user = userEvent.setup();
    renderForm();
    const card = await addCatalogLine(user);

    await user.click(within(card).getByLabelText(/Usar de stock/));
    expect(within(card).getByText(/Queda lista de inmediato/)).toBeInTheDocument();

    await user.click(within(card).getByLabelText(/Personalizado/));
    expect(within(card).getByText(/Pasa directo a Decoración/)).toBeInTheDocument();
  });

  it('pre-fills the personalization when editing an order', async () => {
    const order: Order = {
      id: 'o1', orderNumber: 'ORD-1', orderType: 'products', customerName: 'Juana', customerPhone: '70011122',
      pickupDate: new Date(2099, 9, 10), pickupTime: '15:30', status: 'pending',
      items: [{
        productId: 'p1', product: products[0], quantity: 2, price: 15,
        customizationNotes: 'Papel comestible', customizationPrice: 10, referenceImages: ['https://signed/a.jpg'],
      }],
      customCakes: [], sweetTableCombos: [], sweetTableExtras: [],
      deliveryCost: 0, deposit: 0, total: 50, createdAt: new Date(2026, 8, 1), createdBy: 'u1',
    } as unknown as Order;
    renderForm({ initialData: order, isEditing: true });

    expect(screen.getByDisplayValue('Papel comestible')).toBeInTheDocument();
    expect(screen.getByAltText('Referencia 1')).toHaveAttribute('src', 'https://signed/a.jpg');
    expect(within(getTotalsRow('Subtotal:')).getByText('Bs. 50.00')).toBeInTheDocument();
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

    await user.click(within(extraRow).getByRole('button', { name: 'Quitar postre' }));

    expect(screen.getByText('Sin postres adicionales. Estos se agregan por separado de las mesas dulces.')).toBeInTheDocument();
  });
});

describe('OrderForm - imágenes de mesa dulce', () => {
  const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'mesa.jpg', { type: 'image/jpeg' });
  const makeUploads = (urls: string[]) => ({
    uploadOrderImage: vi.fn().mockImplementation(async () => ({ key: 'Pedidos/x.jpg', url: urls.shift() })),
    uploadProductImage: vi.fn(),
    removeProductImage: vi.fn(),
  }) as any;

  it('lets you attach images to a predefined sweet table and sends them with the combo', async () => {
    const user = userEvent.setup();
    const uploadsApi = makeUploads(['https://signed/mesa.jpg']);
    const { onSubmit } = renderForm({ uploadsApi });

    await user.click(screen.getByLabelText('Mesa dulce'));
    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);

    const combo = screen.getByText('Mesa Dulce 50').closest('.border') as HTMLElement;
    fireEvent.change(within(combo).getByLabelText('Seleccionar imágenes de referencia'), { target: { files: [photo()] } });

    await waitFor(() => expect(within(combo).getByAltText('Referencia 1')).toHaveAttribute('src', 'https://signed/mesa.jpg'));

    await fillRequiredCustomerFields(user);
    // la mesa predefinida ya viene con la composición válida
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].sweetTableCombos[0].referenceImages).toEqual(['https://signed/mesa.jpg']);
    expect(uploadsApi.uploadOrderImage).toHaveBeenCalledTimes(1);
  });

  it('lets you attach images to an additional dessert independently of the sweet tables', async () => {
    const user = userEvent.setup();
    const uploadsApi = makeUploads(['https://signed/postre.jpg']);
    const { onSubmit } = renderForm({ uploadsApi });

    await user.click(screen.getByLabelText('Mesa dulce'));
    await user.click(screen.getByRole('button', { name: /Agregar postre/i }));
    const extraSelect = within(getMesaDulceSection()).getAllByRole('combobox')[1];
    await chooseOption(user, extraSelect, /Galleta - Bs\. 5/);

    const extraRow = extraSelect.closest('.items-end') as HTMLElement;
    fireEvent.change(within(extraRow).getByLabelText('Seleccionar imágenes de referencia'), { target: { files: [photo()] } });
    await waitFor(() => expect(within(extraRow).getByAltText('Referencia 1')).toBeInTheDocument());

    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit.mock.calls[0][0].sweetTableExtras[0]).toMatchObject({
      productId: expect.any(String), referenceImages: ['https://signed/postre.jpg'],
    });
  });

  it('removing an image from a sweet table takes it out of the payload', async () => {
    const user = userEvent.setup();
    const uploadsApi = makeUploads(['https://signed/a.jpg', 'https://signed/b.jpg']);
    const { onSubmit } = renderForm({ uploadsApi });

    await user.click(screen.getByLabelText('Mesa dulce'));
    await chooseOption(user, getPresetComboSelect(), /Mesa Dulce 50/);
    const combo = screen.getByText('Mesa Dulce 50').closest('.border') as HTMLElement;
    const input = within(combo).getByLabelText('Seleccionar imágenes de referencia');
    fireEvent.change(input, { target: { files: [photo(), photo()] } });
    await waitFor(() => expect(within(combo).getAllByAltText(/Referencia/)).toHaveLength(2));

    await user.click(within(combo).getByRole('button', { name: 'Quitar imagen 1' }));
    await fillRequiredCustomerFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear Pedido' }));

    expect(onSubmit.mock.calls[0][0].sweetTableCombos[0].referenceImages).toEqual(['https://signed/b.jpg']);
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
    pickupDate: new Date(2099, 9, 10),
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
    expect(dateInput.value).toBe('2099-10-10');
    expect(screen.getByRole('button', { name: '15:30' })).toBeInTheDocument();

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

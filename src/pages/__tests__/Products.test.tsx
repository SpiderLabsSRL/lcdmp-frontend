import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import type { IProductsApi } from '@/api/ProductsApi';
import type { Product, Flavor, SweetTableCombo } from '@/types';

// Radix Select/Switch use ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { toast } from 'sonner';
import Products from '../Products';
import { useIsMobile } from '@/hooks/use-mobile';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

const mockedUseIsMobile = useIsMobile as unknown as ReturnType<typeof vi.fn>;

const baseProducts: Product[] = [
  {
    id: 'p1',
    name: 'Torta de chocolate',
    description: 'Torta clásica',
    basePrice: 120,
    category: 'cake',
    portionSize: 10,
    pricePerPortion: 12,
    isActive: true,
    location: 'store',
    stock: 5,
    minStock: 2,
  },
  {
    id: 'p2',
    name: 'Cupcake vainilla',
    description: 'Cupcake individual',
    basePrice: 15,
    category: 'cupcake',
    portionSize: 1,
    pricePerPortion: 15,
    isActive: true,
    location: 'production',
    stock: 1,
    minStock: 5,
  },
];

const baseFlavors: Flavor[] = [
  { id: 'f1', name: 'Chocolate', type: 'cake', isActive: true },
  { id: 'f2', name: 'Manjar', type: 'filling', isActive: false },
];

const baseCombos: SweetTableCombo[] = [
  {
    id: 'c1',
    name: 'Combo 50 postres',
    totalQuantity: 50,
    fixedPrice: 400,
    price: 400,
    products: [
      { productId: 'p1', productName: 'Torta de chocolate', quantity: 20, pricePerUnit: 15 },
      { productId: 'p2', productName: 'Cupcake vainilla', quantity: 30, pricePerUnit: 8 },
    ],
    isPreset: true,
    isActive: true,
  },
];

function buildMockApi(overrides: Partial<IProductsApi> = {}): IProductsApi {
  return {
    getProducts: vi.fn().mockResolvedValue(baseProducts),
    createProduct: vi.fn().mockResolvedValue(baseProducts[0]),
    editProduct: vi.fn().mockResolvedValue(baseProducts[0]),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
    addProductStock: vi.fn().mockResolvedValue(baseProducts[0]),
    getFlavors: vi.fn().mockResolvedValue(baseFlavors),
    createFlavor: vi.fn().mockResolvedValue(baseFlavors[0]),
    editFlavor: vi.fn().mockResolvedValue(baseFlavors[0]),
    toggleFlavorStatus: vi.fn().mockImplementation((id: string, isActive: boolean) =>
      Promise.resolve({ ...baseFlavors.find(f => f.id === id)!, isActive })
    ),
    deleteFlavor: vi.fn().mockResolvedValue(undefined),
    getSweetTableCombos: vi.fn().mockResolvedValue(baseCombos),
    createSweetTableCombo: vi.fn().mockResolvedValue(baseCombos[0]),
    editSweetTableCombo: vi.fn().mockResolvedValue(baseCombos[0]),
    toggleSweetTableComboStatus: vi.fn().mockImplementation((id: string, isActive: boolean) =>
      Promise.resolve({ ...baseCombos.find(c => c.id === id)!, isActive })
    ),
    deleteSweetTableCombo: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

// Helper to interact with a Radix Select given its trigger element.
async function selectOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, optionName: string) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name: optionName });
  await user.click(option);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockedUseIsMobile.mockReturnValue(false);
});

describe('Products - header contextual add button', () => {
  it('shows only the button matching the active tab', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Nuevo Producto/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo Sabor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nueva Mesa Dulce/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Sabores' }));
    expect(screen.getByRole('button', { name: /Nuevo Sabor/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo Producto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nueva Mesa Dulce/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));
    expect(screen.getByRole('button', { name: /Nueva Mesa Dulce/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo Producto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo Sabor/i })).not.toBeInTheDocument();
  });
});

describe('Products - Productos tab', () => {
  it('shows a loading spinner while products are loading', async () => {
    let resolveProducts: (v: Product[]) => void;
    const pending = new Promise<Product[]>(resolve => { resolveProducts = resolve; });
    const api = buildMockApi({ getProducts: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Products api={api} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolveProducts!(baseProducts);
    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
  });

  it('shows the empty state when there are no products at all', async () => {
    const api = buildMockApi({ getProducts: vi.fn().mockResolvedValue([]) });
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('No se encontraron productos')).toBeInTheDocument());
  });

  it('renders the populated product table with category, price and stock', async () => {
    const api = buildMockApi();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    expect(screen.getByText('Cupcake vainilla')).toBeInTheDocument();
    expect(screen.getByText('Bs. 120')).toBeInTheDocument();
    expect(screen.getByText('Tortas')).toBeInTheDocument();
    expect(screen.getByText('Cupcakes')).toBeInTheDocument();
  });

  it('creates a new product via the dialog form', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Nuevo Producto/i }));
    expect(screen.getByRole('heading', { name: 'Nuevo Producto' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Torta red velvet');
    const priceInputs = screen.getAllByPlaceholderText('0');
    await user.type(priceInputs[0], '200');

    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalled());
    expect(api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Torta red velvet', basePrice: 200 })
    );
    expect(toast.success).toHaveBeenCalledWith('Producto "Torta red velvet" creado exitosamente');
  });

  it('creates a product with an automatic restock quantity configured', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Nuevo Producto/i }));
    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Empanadas de queso');
    const priceInputs = screen.getAllByPlaceholderText('0');
    await user.type(priceInputs[0], '5');
    await user.type(screen.getByPlaceholderText('Sin reposición automática'), '20');

    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalled());
    expect(api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Empanadas de queso', restockQuantity: 20 })
    );
  });

  it('creates a product with no restock quantity (null) when left empty', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Nuevo Producto/i }));
    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'Brownie');
    const priceInputs = screen.getAllByPlaceholderText('0');
    await user.type(priceInputs[0], '5');

    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalled());
    expect(api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Brownie', restockQuantity: null })
    );
  });

  it('edits an existing product via the row edit button', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    const row = screen.getByText('Torta de chocolate').closest('tr')!;
    const editBtn = within(row).getByTitle('Editar');
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Editar Producto' })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('Nombre del producto') as HTMLInputElement;
    expect(nameInput.value).toBe('Torta de chocolate');

    await user.click(screen.getByRole('button', { name: 'Actualizar Producto' }));

    await waitFor(() => expect(api.editProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'Torta de chocolate' })
    ));
    expect(toast.success).toHaveBeenCalledWith('Producto "Torta de chocolate" actualizado exitosamente');
  });

  it('deletes a product through the confirmation dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    const row = screen.getByText('Torta de chocolate').closest('tr')!;
    await user.click(within(row).getByTitle('Eliminar'));

    expect(screen.getByRole('heading', { name: 'Eliminar producto' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Eliminar Producto/i }));

    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Producto "Torta de chocolate" eliminado exitosamente');
  });

  it('adds stock to a product through the stock dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

    const row = screen.getByText('Torta de chocolate').closest('tr')!;
    await user.click(within(row).getByTitle('Agregar stock'));

    expect(screen.getByText('Agregar Stock - Torta de chocolate')).toBeInTheDocument();
    expect(screen.getByText('5 unidades')).toBeInTheDocument();

    const qtyInput = screen.getByPlaceholderText('Cantidad');
    await user.clear(qtyInput);
    await user.type(qtyInput, '10');

    expect(screen.getByText('15 unidades')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agregar Stock/i }));

    await waitFor(() => expect(api.addProductStock).toHaveBeenCalledWith({ productId: 'p1', quantity: 10 }));
  });
});

describe('Products - Sabores tab', () => {
  it('lists cake and filling flavors separately', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Sabores' }));

    expect(screen.getByText('Sabores de Torta')).toBeInTheDocument();
    expect(screen.getByText('Sabores de Relleno')).toBeInTheDocument();
    expect(screen.getByText('Chocolate')).toBeInTheDocument();
    expect(screen.getByText('Manjar')).toBeInTheDocument();
  });

  it('creates a new flavor via the dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Sabores' }));
    await user.click(screen.getByRole('button', { name: /Nuevo Sabor/i }));

    await user.type(screen.getByPlaceholderText('Ej: Chocolate belga'), 'Fresa');
    await user.click(screen.getByRole('button', { name: 'Crear Sabor' }));

    await waitFor(() => expect(api.createFlavor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fresa', type: 'cake', isActive: true })
    ));
    expect(toast.success).toHaveBeenCalledWith('Sabor "Fresa" creado exitosamente');
  });

  it('edits an existing flavor', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Sabores' }));

    const flavorRow = screen.getByText('Chocolate').closest('div')!;
    const editBtn = within(flavorRow).getAllByRole('button')[0];
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Editar Sabor' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actualizar Sabor' }));

    await waitFor(() => expect(api.editFlavor).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', name: 'Chocolate' })
    ));
  });

  it('toggles a flavor active status via the switch', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Sabores' }));

    const flavorRow = screen.getByText('Chocolate').closest('div')!;
    const toggleSwitch = within(flavorRow).getByRole('switch');
    await user.click(toggleSwitch);

    await waitFor(() => expect(api.toggleFlavorStatus).toHaveBeenCalledWith('f1', false));
  });

  it('deletes a flavor through the confirmation dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Sabores' }));

    const flavorRow = screen.getByText('Chocolate').closest('div')!;
    const deleteBtn = within(flavorRow).getAllByRole('button')[1];
    await user.click(deleteBtn);

    expect(screen.getByRole('heading', { name: 'Eliminar sabor' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Eliminar Sabor/i }));

    await waitFor(() => expect(api.deleteFlavor).toHaveBeenCalledWith('f1'));
  });
});

describe('Products - Mesa Dulce tab', () => {
  it('shows the empty state with a CTA to create the first combo', async () => {
    const api = buildMockApi({ getSweetTableCombos: vi.fn().mockResolvedValue([]) });
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));

    await waitFor(() => expect(screen.getByText('No hay mesas dulces configuradas todavía')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Crear la primera mesa dulce/i })).toBeInTheDocument();
  });

  it('renders combo cards with product breakdown and price', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));

    await waitFor(() => expect(screen.getByText('Combo 50 postres')).toBeInTheDocument());
    expect(screen.getByText('50 postres')).toBeInTheDocument();
    expect(screen.getByText('Bs. 400')).toBeInTheDocument();
    expect(screen.getByText('20 × Torta de chocolate')).toBeInTheDocument();
    expect(screen.getByText('30 × Cupcake vainilla')).toBeInTheDocument();
  });

  it('toggles a combo active status via the switch', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));
    await waitFor(() => expect(screen.getByText('Combo 50 postres')).toBeInTheDocument());

    const comboCard = screen.getByText('Combo 50 postres').closest('.transition-opacity')!;
    const toggleSwitch = within(comboCard as HTMLElement).getByRole('switch');
    await user.click(toggleSwitch);

    await waitFor(() => expect(api.toggleSweetTableComboStatus).toHaveBeenCalledWith('c1', false));
  });

  it('deletes a combo through the confirmation dialog', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));
    await waitFor(() => expect(screen.getByText('Combo 50 postres')).toBeInTheDocument());

    const comboCard = screen.getByText('Combo 50 postres').closest('.transition-opacity')!;
    const deleteBtn = within(comboCard as HTMLElement).getAllByRole('button').at(-1)!;
    await user.click(deleteBtn);

    expect(screen.getByRole('heading', { name: 'Eliminar mesa dulce' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Eliminar Mesa Dulce/i }));

    await waitFor(() => expect(api.deleteSweetTableCombo).toHaveBeenCalledWith('c1'));
  });

  it('opens the create combo dialog and auto-computes the suggested price from rows', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));
    await user.click(screen.getByRole('button', { name: /Nueva Mesa Dulce/i }));

    expect(screen.getByRole('heading', { name: 'Nueva Mesa Dulce' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ej: Combo 50 postres'), 'Combo nuevo');

    // Select the first product in the only row, then set quantity.
    const productTrigger = screen.getByRole('combobox');
    await selectOption(user, productTrigger, 'Torta de chocolate');

    const qtyInput = screen.getByPlaceholderText('Cant.');
    await user.clear(qtyInput);
    await user.type(qtyInput, '4');

    // basePrice of Torta de chocolate is 120, so pricePerUnit auto-fills to 120,
    // and suggested price = 4 * 120 = 480.
    await waitFor(() => {
      const priceField = screen.getAllByRole('spinbutton').find(el => (el as HTMLInputElement).value === '480');
      expect(priceField).toBeTruthy();
    });
  });

  it('stops auto-syncing the price once the user edits it manually, and shows a reset link', async () => {
    const api = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Products api={api} />);

    await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Mesa Dulce' }));
    await user.click(screen.getByRole('button', { name: /Nueva Mesa Dulce/i }));

    await user.type(screen.getByPlaceholderText('Ej: Combo 50 postres'), 'Combo manual');

    const productTrigger = screen.getByRole('combobox');
    await selectOption(user, productTrigger, 'Torta de chocolate');

    const qtyInput = screen.getByPlaceholderText('Cant.');
    await user.clear(qtyInput);
    await user.type(qtyInput, '2');
    // suggested price now 240

    await waitFor(() => {
      const priceField = screen.getAllByRole('spinbutton').find(el => (el as HTMLInputElement).value === '240');
      expect(priceField).toBeTruthy();
    });

    const priceField = screen.getAllByRole('spinbutton').find(el => (el as HTMLInputElement).value === '240') as HTMLInputElement;
    await user.clear(priceField);
    await user.type(priceField, '999');

    // Now change quantity again; price should stay manually set at 999, not resync.
    await user.clear(qtyInput);
    await user.type(qtyInput, '5');

    await waitFor(() => expect(priceField.value).toBe('999'));

    // Reset link should reappear since suggested (5*120=600) diverges from 999.
    const resetLink = screen.getByRole('button', { name: /Usar precio sugerido: Bs\. 600\.00/i });
    expect(resetLink).toBeInTheDocument();

    await user.click(resetLink);
    await waitFor(() => expect(priceField.value).toBe('600'));
  });
});

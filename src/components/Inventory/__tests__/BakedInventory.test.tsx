import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix Select usa ResizeObserver y pointer capture, que jsdom no implementa.
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));

import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { BakedInventoryTab } from '../BakedInventoryTab';
import { BakedBatchDialog } from '../BakedBatchDialog';
import type { IBakedApi } from '@/api/BakedApi';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { BakedItem, DoughType } from '@/types';

const cakeType: DoughType = { id: 'dt-cake', name: 'Masa de torta', usesPortions: true, usesShape: true, isCake: true, isActive: true, usesFlavor: true, isCuttable: false, unitName: null, defaultPortions: null };
const cookieType: DoughType = { id: 'dt-cookie', name: 'Galleta de alfajor', usesPortions: false, usesShape: false, isCake: false, isActive: true, usesFlavor: true, isCuttable: false, unitName: null, defaultPortions: null };

const cakeItem: BakedItem = {
  id: 'i1', doughTypeId: 'dt-cake', doughTypeName: 'Masa de torta', name: 'Masa de torta · Chocolate · 20 porciones · redonda',
  flavor: 'Chocolate', portions: 20, shape: 'redonda', quantity: 1, minStock: 4, createdAt: '2026-01-01T00:00:00.000Z',
};
const cookieItem: BakedItem = {
  id: 'i2', doughTypeId: 'dt-cookie', doughTypeName: 'Galleta de alfajor', name: 'Galleta de alfajor · Vainilla',
  flavor: 'Vainilla', portions: null, shape: null, quantity: 50, minStock: 10, createdAt: '2026-01-01T00:00:00.000Z',
};

const ordersApi = { getFlavors: vi.fn().mockResolvedValue([{ id: 'f1', name: 'Chocolate', type: 'cake' }]) } as unknown as IOrdersApi;

const buildApi = (overrides: Partial<IBakedApi> = {}): IBakedApi => ({
  getDoughTypes: vi.fn().mockResolvedValue([cakeType, cookieType]),
  getItems: vi.fn().mockResolvedValue([cakeItem, cookieItem]),
  getMovements: vi.fn().mockResolvedValue([]),
  addBatch: vi.fn().mockResolvedValue({ ...cookieItem, quantity: 80 }),
  registerWaste: vi.fn().mockResolvedValue(cookieItem),
  adjustStock: vi.fn().mockResolvedValue(cookieItem),
  updateItemMinStock: vi.fn().mockResolvedValue(cookieItem),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  createDoughType: vi.fn().mockResolvedValue(cookieType),
  updateDoughType: vi.fn().mockResolvedValue(cookieType),
  ...overrides,
} as unknown as IBakedApi);

beforeEach(() => vi.clearAllMocks());

describe('BakedInventoryTab', () => {
  it('lists the items with type, flavor, portions, shape and stock, flagging the low ones', async () => {
    render(<BakedInventoryTab bakedApi={buildApi()} ordersApi={ordersApi} />);

    expect(await screen.findByText('Chocolate')).toBeInTheDocument();
    const row = screen.getByText('Chocolate').closest('tr')!;
    expect(within(row).getByText('Masa de torta')).toBeInTheDocument();
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(within(row).getByText('Redonda')).toBeInTheDocument();
    expect(within(row).getByText('Bajo')).toBeInTheDocument();

    const cookieRow = screen.getByText('Vainilla').closest('tr')!;
    expect(within(cookieRow).queryByText('Bajo')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    render(<BakedInventoryTab bakedApi={buildApi({ getItems: vi.fn().mockResolvedValue([]) })} ordersApi={ordersApi} />);

    expect(await screen.findByText('No hay masas horneadas registradas')).toBeInTheDocument();
  });

  it('registers a waste with its reason and refreshes', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    const onChanged = vi.fn();
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} onChanged={onChanged} />);

    await user.click(await screen.findByRole('button', { name: /Merma de Galleta de alfajor/ }));
    await user.type(screen.getByLabelText(/Cantidad a descartar/), '5');
    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(api.registerWaste).toHaveBeenCalledWith('i2', { quantity: 5, wasteReason: 'expired', notes: undefined }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not let a waste exceed the stock', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Merma de Masa de torta/ }));
    await user.type(screen.getByLabelText(/Cantidad a descartar/), '9');
    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(toast.error).toHaveBeenCalledWith('Solo hay 1 en el inventario');
    expect(api.registerWaste).not.toHaveBeenCalled();
  });

  it('adjusts the stock down with a note', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Ajustar Galleta de alfajor/ }));
    await user.click(screen.getByRole('button', { name: 'Restar' }));
    await user.type(screen.getByLabelText('Unidades'), '3');
    await user.type(screen.getByLabelText('Motivo del ajuste'), 'conteo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.adjustStock).toHaveBeenCalledWith('i2', { delta: -3, notes: 'conteo' }));
  });

  it('shows the movement history of an item', async () => {
    const user = userEvent.setup();
    const api = buildApi({
      getMovements: vi.fn().mockResolvedValue([
        { id: 'm1', bakedProductId: 'i1', itemName: 'x', direction: 'out', quantity: 2, reason: 'order_assembly', wasteReason: null, shortage: 1, orderNumber: 'ORD-9', notes: null, createdAt: '2026-05-01T10:00:00.000Z', createdByName: 'Ana' },
      ]),
    });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Historial de Masa de torta/ }));

    expect(await screen.findByText(/Armado de pedido/)).toBeInTheDocument();
    expect(screen.getByText(/Pedido #ORD-9/)).toBeInTheDocument();
    expect(screen.getByText('Faltaron 1 en el inventario')).toBeInTheDocument();
  });

  it('creates a dough type from the types dialog', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Tipos de masa/ }));
    await user.type(await screen.findByLabelText('Nombre del tipo'), 'Conitos');
    await user.click(screen.getByLabelText('Usa porciones'));
    await user.click(screen.getByRole('button', { name: 'Crear tipo' }));

    await waitFor(() => expect(api.createDoughType).toHaveBeenCalledWith({ name: 'Conitos', usesPortions: false, usesShape: false }));
  });
});

describe('BakedBatchDialog', () => {
  const setup = (api = buildApi()) => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<BakedBatchDialog open onOpenChange={onOpenChange} bakedApi={api} ordersApi={ordersApi} onSaved={onSaved} />);
    return { api, onSaved, onOpenChange };
  };

  const pickType = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name }));
  };

  it('asks for the type, flavor and quantity before saving', async () => {
    const user = userEvent.setup();
    const { api } = setup();

    await user.click(await screen.findByRole('button', { name: 'Registrar' }));
    expect(toast.error).toHaveBeenLastCalledWith('Elige el tipo de masa');

    await pickType(user, 'Galleta de alfajor');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(toast.error).toHaveBeenLastCalledWith('Indica el sabor');

    await user.type(screen.getByLabelText(/Sabor/), 'Vainilla');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(toast.error).toHaveBeenLastCalledWith('Indica cuántas unidades se hornearon');
    expect(api.addBatch).not.toHaveBeenCalled();
  });

  it('shows portions and shape only for types that use them', async () => {
    const user = userEvent.setup();
    setup();

    await pickType(user, 'Galleta de alfajor');
    expect(screen.queryByLabelText(/Porciones/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Forma' })).not.toBeInTheDocument();

    await pickType(user, 'Masa de torta');
    expect(screen.getByLabelText(/Porciones/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Forma' })).toBeInTheDocument();
  });

  it('sends a cookie batch without portions or shape', async () => {
    const user = userEvent.setup();
    const { api, onSaved, onOpenChange } = setup();

    await pickType(user, 'Galleta de alfajor');
    await user.type(screen.getByLabelText(/Sabor/), 'Vainilla');
    await user.type(screen.getByLabelText(/Cantidad horneada/), '30');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(api.addBatch).toHaveBeenCalledWith({
      doughTypeId: 'dt-cookie', flavor: 'Vainilla', portions: null, shape: null, quantity: 30, notes: undefined,
    }));
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends a cake dough batch with its portions and shape', async () => {
    const user = userEvent.setup();
    const { api } = setup();

    await pickType(user, 'Masa de torta');
    await user.click(screen.getByRole('combobox', { name: 'Sabor' }));
    await user.click(await screen.findByRole('option', { name: 'Chocolate' }));
    await user.type(screen.getByLabelText(/Porciones/), '20');
    await user.click(screen.getByRole('combobox', { name: 'Forma' }));
    await user.click(await screen.findByRole('option', { name: 'Redonda' }));
    await user.type(screen.getByLabelText(/Cantidad horneada/), '4');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(api.addBatch).toHaveBeenCalledWith(expect.objectContaining({
      doughTypeId: 'dt-cake', flavor: 'Chocolate', portions: 20, shape: 'redonda', quantity: 4,
    })));
  });
});

describe('masas que se cortan (mil hojas, tres leches...)', () => {
  const milHojas: DoughType = {
    id: 'dt-mh', name: 'Mil hojas', usesPortions: true, usesShape: false, isCake: false, isActive: true,
    usesFlavor: true, isCuttable: true, unitName: 'lámina', defaultPortions: 12,
  };
  const wholeItem: BakedItem = {
    id: 'w1', doughTypeId: 'dt-mh', doughTypeName: 'Mil hojas', name: 'Mil hojas · Clásica · lámina',
    flavor: 'Clásica', portions: null, shape: null, quantity: 5, minStock: 0, createdAt: '2026-01-01T00:00:00.000Z',
    isCuttable: true, unitName: 'lámina', defaultPortions: 12,
  };
  const pieceItem: BakedItem = { ...wholeItem, id: 'p1', name: 'Mil hojas · Clásica · 12 porciones', portions: 12, quantity: 24 };

  const setupBatch = (doughTypes: DoughType[]) => {
    const api = buildApi({ getDoughTypes: vi.fn().mockResolvedValue(doughTypes) });
    render(<BakedBatchDialog open onOpenChange={vi.fn()} bakedApi={api} ordersApi={ordersApi} onSaved={vi.fn()} />);
    return { api };
  };
  const pickType = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name }));
  };

  const cutResult = { whole: { ...wholeItem, quantity: 3 }, pieces: { ...pieceItem, quantity: 48 }, shortage: 0 };

  it('shows the unit instead of portions for a whole unit, and offers Cortar only on those', async () => {
    const api = buildApi({ getItems: vi.fn().mockResolvedValue([wholeItem, pieceItem]), getDoughTypes: vi.fn().mockResolvedValue([milHojas]) });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await screen.findByText('lámina');
    expect(screen.getByRole('button', { name: `Cortar ${wholeItem.name}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Cortar ${pieceItem.name}` })).not.toBeInTheDocument();
  });

  it('cuts whole units into pieces: sends the amounts and refreshes', async () => {
    const user = userEvent.setup();
    const cutItem = vi.fn().mockResolvedValue(cutResult);
    const api = buildApi({ getItems: vi.fn().mockResolvedValue([wholeItem]), getDoughTypes: vi.fn().mockResolvedValue([milHojas]), cutItem });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: `Cortar ${wholeItem.name}` }));
    expect(screen.getByLabelText(/Porciones de cada pieza/)).toHaveValue(12); // sugerida por el tipo

    await user.clear(screen.getByLabelText(/Láminas que se cortan/));
    await user.type(screen.getByLabelText(/Láminas que se cortan/), '2');
    await user.type(screen.getByLabelText(/Piezas que salieron/), '4');
    await user.click(screen.getByRole('button', { name: 'Registrar corte' }));

    await waitFor(() => expect(cutItem).toHaveBeenCalledWith('w1', { quantity: 2, portions: 12, pieces: 4, notes: undefined }));
    expect(toast.success).toHaveBeenCalledWith('Corte registrado: 4 piezas de 12 porciones');
  });

  it('warns when there were not enough whole units, but the cut is registered', async () => {
    const user = userEvent.setup();
    const cutItem = vi.fn().mockResolvedValue({ ...cutResult, shortage: 2 });
    const api = buildApi({ getItems: vi.fn().mockResolvedValue([wholeItem]), getDoughTypes: vi.fn().mockResolvedValue([milHojas]), cutItem });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: `Cortar ${wholeItem.name}` }));
    await user.type(screen.getByLabelText(/Piezas que salieron/), '4');
    await user.click(screen.getByRole('button', { name: 'Registrar corte' }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Faltaban 2 láminas en el inventario: el corte se registró igual'));
  });

  it('requires the amounts before cutting', async () => {
    const user = userEvent.setup();
    const cutItem = vi.fn();
    const api = buildApi({ getItems: vi.fn().mockResolvedValue([wholeItem]), getDoughTypes: vi.fn().mockResolvedValue([milHojas]), cutItem });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: `Cortar ${wholeItem.name}` }));
    await user.click(screen.getByRole('button', { name: 'Registrar corte' }));

    expect(toast.error).toHaveBeenCalledWith('Indica cuántas piezas salieron');
    expect(cutItem).not.toHaveBeenCalled();
  });

  it('a cuttable type lets Hornos register the whole unit (no portions) or a cut piece', async () => {
    const user = userEvent.setup();
    const { api } = setupBatch([milHojas]);

    await pickType(user, 'Mil hojas');
    await user.type(screen.getByLabelText(/Sabor/), 'Clásica');
    expect(screen.queryByLabelText(/Porciones/)).not.toBeInTheDocument(); // entera: sin porciones
    await user.type(screen.getByLabelText(/Cantidad horneada/), '6');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(api.addBatch).toHaveBeenCalledWith(expect.objectContaining({
      doughTypeId: 'dt-mh', flavor: 'Clásica', portions: null, quantity: 6,
    })));
  });

  it('the admin creates a type that is cut with its unit and default portions', async () => {
    const user = userEvent.setup();
    const createDoughType = vi.fn().mockResolvedValue(milHojas);
    const api = buildApi({ createDoughType });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Tipos de masa/ }));
    await user.type(screen.getByLabelText('Nombre del tipo'), 'Mil hojas');
    await user.click(screen.getByRole('switch', { name: 'Se corta en porciones' }));
    await user.click(screen.getByRole('button', { name: 'Crear tipo' }));
    expect(toast.error).toHaveBeenCalledWith('Indica la unidad de la masa que se corta (lámina, masa grande...)');

    await user.type(screen.getByLabelText('Unidad'), 'lámina');
    await user.type(screen.getByLabelText('Porciones por defecto'), '12');
    await user.click(screen.getByRole('button', { name: 'Crear tipo' }));

    await waitFor(() => expect(createDoughType).toHaveBeenCalledWith({
      name: 'Mil hojas', usesPortions: true, usesShape: false, isCuttable: true, unitName: 'lámina', defaultPortions: 12,
    }));
  });

  it('the cake dough only offers the registered cake flavors (no free text)', async () => {
    const user = userEvent.setup();
    setupBatch([cakeType, cookieType]);

    await pickType(user, 'Masa de torta');

    expect(screen.queryByRole('textbox', { name: /Sabor/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Sabor' }));
    expect(await screen.findByRole('option', { name: 'Chocolate' })).toBeInTheDocument();
  });
});

describe('masas sin sabor (pie...)', () => {
  const pieType: DoughType = {
    id: 'dt-pie', name: 'Masa de pie', usesPortions: true, usesShape: false, isCake: false, isActive: true,
    usesFlavor: false, isCuttable: false, unitName: null, defaultPortions: null,
  };
  const pieItem: BakedItem = {
    id: 'pi1', doughTypeId: 'dt-pie', doughTypeName: 'Masa de pie', name: 'Masa de pie · 8 porciones',
    flavor: '', portions: 8, shape: null, quantity: 10, minStock: 0, createdAt: '2026-01-01T00:00:00.000Z',
  };

  const setupBatch = (doughTypes: DoughType[]) => {
    const api = buildApi({ getDoughTypes: vi.fn().mockResolvedValue(doughTypes) });
    render(<BakedBatchDialog open onOpenChange={vi.fn()} bakedApi={api} ordersApi={ordersApi} onSaved={vi.fn()} />);
    return { api };
  };

  it('does not ask for the flavor and registers the batch with an empty one', async () => {
    const user = userEvent.setup();
    const { api } = setupBatch([pieType]);

    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name: 'Masa de pie' }));

    expect(screen.queryByLabelText(/Sabor/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Porciones/), '8');
    await user.type(screen.getByLabelText(/Cantidad horneada/), '5');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(api.addBatch).toHaveBeenCalledWith(expect.objectContaining({
      doughTypeId: 'dt-pie', flavor: '', portions: 8, quantity: 5,
    })));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a dash in the Sabor column for items without flavor', async () => {
    const api = buildApi({ getItems: vi.fn().mockResolvedValue([pieItem]), getDoughTypes: vi.fn().mockResolvedValue([pieType]) });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    const row = (await screen.findByText('Masa de pie')).closest('tr')!;
    expect(within(row).getByText('8')).toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('the admin creates a type without flavor with the "Usa sabor" switch off', async () => {
    const user = userEvent.setup();
    const createDoughType = vi.fn().mockResolvedValue(pieType);
    const api = buildApi({ createDoughType });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Tipos de masa/ }));
    await user.type(screen.getByLabelText('Nombre del tipo'), 'Masa de pie');
    await user.click(screen.getByRole('switch', { name: 'Usa sabor' }));
    await user.click(screen.getByRole('button', { name: 'Crear tipo' }));

    await waitFor(() => expect(createDoughType).toHaveBeenCalledWith({
      name: 'Masa de pie', usesPortions: true, usesShape: false, usesFlavor: false,
    }));
  });

  it('the dough types list says which types have no flavor', async () => {
    const user = userEvent.setup();
    const api = buildApi({ getDoughTypes: vi.fn().mockResolvedValue([cakeType, pieType]) });
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);

    await user.click(await screen.findByRole('button', { name: /Tipos de masa/ }));

    expect(await screen.findByText(/sin sabor/)).toBeInTheDocument();
  });
});

describe('registrar horneado de una masa que se corta', () => {
  const milHojas: DoughType = {
    id: 'dt-mh2', name: 'Mil hojas', usesPortions: true, usesShape: false, isCake: false, isActive: true,
    usesFlavor: true, isCuttable: true, unitName: 'lámina', defaultPortions: 12,
  };

  it('does not ask for the presentation: baking always produces the whole unit', async () => {
    const user = userEvent.setup();
    const api = buildApi({ getDoughTypes: vi.fn().mockResolvedValue([milHojas]) });
    render(<BakedBatchDialog open onOpenChange={vi.fn()} bakedApi={api} ordersApi={ordersApi} onSaved={vi.fn()} />);

    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name: 'Mil hojas' }));

    expect(screen.queryByText('Presentación')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pieza cortada' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Porciones/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Sabor/), 'Clásica');
    await user.type(screen.getByLabelText(/Cantidad horneada/), '6');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(api.addBatch).toHaveBeenCalledWith(expect.objectContaining({
      doughTypeId: 'dt-mh2', flavor: 'Clásica', portions: null, quantity: 6,
    })));
  });
});

describe('BakedInventoryTab en movil', () => {
  beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(true));

  const renderTab = (api = buildApi()) => {
    render(<BakedInventoryTab bakedApi={api} ordersApi={ordersApi} />);
    return api;
  };

  it('shows a card per item instead of the table, so nothing needs sideways scrolling', async () => {
    renderTab();

    expect(await screen.findByText('Masa de torta')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // el detalle del item va en una sola linea bajo el tipo de masa
    expect(screen.getByText('Chocolate · 20 porciones · Redonda')).toBeInTheDocument();
    expect(screen.getByText('Vainilla')).toBeInTheDocument();
  });

  it('shows the stock with its minimum and flags the low ones', async () => {
    renderTab();

    await screen.findByText('Masa de torta');
    expect(screen.getAllByText('Stock')).toHaveLength(2);
    expect(screen.getByText('/ min 4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Bajo')).toBeInTheDocument(); // solo la masa de torta
  });

  it('keeps every action reachable on the card', async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Masa de torta');
    expect(screen.getByRole('button', { name: `Ajustar ${cakeItem.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Merma de ${cakeItem.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Eliminar ${cakeItem.name}` })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Historial de ${cakeItem.name}` }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });

  it('offers Cortar on the whole unit of a cuttable dough', async () => {
    const milHojas: DoughType = {
      id: 'dt-mh3', name: 'Mil hojas', usesPortions: true, usesShape: false, isCake: false, isActive: true,
      usesFlavor: true, isCuttable: true, unitName: 'lamina', defaultPortions: 12,
    };
    const whole: BakedItem = {
      id: 'w9', doughTypeId: 'dt-mh3', doughTypeName: 'Mil hojas', name: 'Mil hojas · Clasica · lamina',
      flavor: 'Clasica', portions: null, shape: null, quantity: 4, minStock: 0, createdAt: '2026-01-01T00:00:00.000Z',
      isCuttable: true, unitName: 'lamina', defaultPortions: 12,
    };
    renderTab(buildApi({ getItems: vi.fn().mockResolvedValue([whole]), getDoughTypes: vi.fn().mockResolvedValue([milHojas]) }));

    expect(await screen.findByText('Clasica · lamina')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cortar ${whole.name}` })).toBeInTheDocument();
  });

  it('shows the empty state as a card', async () => {
    renderTab(buildApi({ getItems: vi.fn().mockResolvedValue([]) }));

    expect(await screen.findByText('No hay masas horneadas registradas')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

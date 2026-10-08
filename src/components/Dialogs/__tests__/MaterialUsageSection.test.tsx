import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialUsageSection from '../MaterialUsageSection';
import type { IMaterialsApi, MaterialMovement } from '@/api/MaterialsApi';
import type { IInventoryApi } from '@/api/InventoryApi';
import type { RawMaterial } from '@/types';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';

const movement: MaterialMovement = {
  id: 'mv1',
  rawMaterialId: 'm1',
  materialName: 'Harina',
  unit: 'kg',
  quantity: 0.6,
  orderId: 'o1',
  orderNumber: 'ORD-1',
  itemType: 'order_item',
  itemId: 'oi1',
  stage: 'baking',
  source: 'recipe',
  notes: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  createdByName: 'Juan Panadero',
};

const rawMaterials: RawMaterial[] = [
  { id: 'm2', name: 'Flores de azúcar', unit: 'unidad', quantity: 40, minStock: 5, category: 'decoration', lastUpdated: new Date() },
];

function setup(canRegister = true, movements: MaterialMovement[] = [movement]) {
  const materialsApi = {
    getMovements: vi.fn().mockResolvedValue(movements),
    registerUsage: vi.fn().mockResolvedValue(undefined),
  } as unknown as IMaterialsApi;
  const inventoryApi = { getRawMaterials: vi.fn().mockResolvedValue(rawMaterials) } as unknown as IInventoryApi;
  render(<MaterialUsageSection orderId="o1" canRegister={canRegister} materialsApi={materialsApi} inventoryApi={inventoryApi} />);
  return { materialsApi, inventoryApi };
}

describe('MaterialUsageSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads nothing until the section is opened, then lists the order movements', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup();
    expect(materialsApi.getMovements).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Materiales usados/ }));

    expect(await screen.findByText('Harina')).toBeInTheDocument();
    expect(materialsApi.getMovements).toHaveBeenCalledWith({ orderId: 'o1' });
    expect(screen.getByText('Horneado')).toBeInTheDocument();
    expect(screen.getByText('Receta')).toBeInTheDocument();
    expect(screen.getByText(/Juan Panadero/)).toBeInTheDocument();
  });

  it('shows an empty state when the order has no movements', async () => {
    const user = userEvent.setup();
    setup(true, []);

    await user.click(screen.getByRole('button', { name: /Materiales usados/ }));

    expect(await screen.findByText('Sin materiales registrados todavía.')).toBeInTheDocument();
  });

  it('registers a manual decoration material and reloads the list', async () => {
    const user = userEvent.setup();
    const { materialsApi, inventoryApi } = setup();
    await user.click(screen.getByRole('button', { name: /Materiales usados/ }));
    await screen.findByText('Harina');
    await waitFor(() => expect(inventoryApi.getRawMaterials).toHaveBeenCalled());

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Flores de azúcar (unidad)' }));
    fireEvent.change(screen.getByLabelText('Cantidad usada'), { target: { value: '6' } });
    await user.type(screen.getByPlaceholderText('Notas (opcional)'), 'diseño floral');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(materialsApi.registerUsage).toHaveBeenCalledWith({
      orderId: 'o1', rawMaterialId: 'm2', quantity: 6, notes: 'diseño floral',
    }));
    await waitFor(() => expect(materialsApi.getMovements).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Material registrado');
  });

  it('requires a raw material before registering', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup();
    await user.click(screen.getByRole('button', { name: /Materiales usados/ }));
    await screen.findByText('Harina');

    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(materialsApi.registerUsage).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('hides the register form (and does not load raw materials) when the order can no longer be edited', async () => {
    const user = userEvent.setup();
    const { inventoryApi } = setup(false);

    await user.click(screen.getByRole('button', { name: /Materiales usados/ }));
    await screen.findByText('Harina');

    expect(screen.queryByText('Registrar materiales de decoración')).not.toBeInTheDocument();
    expect(inventoryApi.getRawMaterials).not.toHaveBeenCalled();
  });
});

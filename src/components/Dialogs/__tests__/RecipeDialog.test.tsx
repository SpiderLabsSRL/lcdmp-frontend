import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeDialog from '../RecipeDialog';
import type { RawMaterial } from '@/types';

// Radix Select/Dialog use ResizeObserver and pointer capture, which jsdom lacks.
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

const rawMaterials: RawMaterial[] = [
  { id: 'm1', name: 'Harina', unit: 'kg', quantity: 50, minStock: 5, category: 'flour', lastUpdated: new Date() },
  { id: 'm2', name: 'Huevos', unit: 'unidad', quantity: 100, minStock: 10, category: 'eggs', lastUpdated: new Date() },
];

const stages = [
  { key: 'baking', label: 'Horneado' },
  { key: 'assembling', label: 'Armado' },
];

function setup(overrides: Partial<React.ComponentProps<typeof RecipeDialog>> = {}) {
  const load = vi.fn().mockResolvedValue({
    baking: [{ rawMaterialId: 'm1', name: 'Harina', unit: 'kg', quantity: 0.5 }],
    assembling: [],
  });
  const save = vi.fn().mockResolvedValue({});
  const onOpenChange = vi.fn();
  render(
    <RecipeDialog
      open
      onOpenChange={onOpenChange}
      title="Receta - Cupcake"
      stages={stages}
      rawMaterials={rawMaterials}
      load={load}
      save={save}
      {...overrides}
    />
  );
  return { load, save, onOpenChange };
}

describe('RecipeDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the recipe when opened and shows the current material with its unit', async () => {
    const { load } = setup();

    expect(await screen.findByText('Receta - Cupcake')).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue('0.5')).toBeInTheDocument();
    expect(screen.getAllByText('kg').length).toBeGreaterThan(0);
    expect(screen.getByText('No consume materiales en esta etapa.')).toBeInTheDocument(); // Armado vacío
  });

  it('saves the edited recipe: adds a material to a stage and sends rawMaterialId + quantity', async () => {
    const user = userEvent.setup();
    const { save, onOpenChange } = setup();
    await screen.findByDisplayValue('0.5');

    const assemblingCard = screen.getByText('Armado').closest('.space-y-2') as HTMLElement;
    await user.click(within(assemblingCard).getByRole('button', { name: /Material/ }));
    await user.click(within(assemblingCard).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Huevos (unidad)' }));
    fireEvent.change(within(assemblingCard).getByLabelText('Cantidad'), { target: { value: '2' } });

    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toEqual({
      baking: [{ rawMaterialId: 'm1', quantity: 0.5 }],
      assembling: [{ rawMaterialId: 'm2', quantity: 2 }],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not save a line without a raw material', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    await screen.findByDisplayValue('0.5');

    const assemblingCard = screen.getByText('Armado').closest('.space-y-2') as HTMLElement;
    await user.click(within(assemblingCard).getByRole('button', { name: /Material/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    expect(save).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('removes a line', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    await screen.findByDisplayValue('0.5');

    const bakingCard = screen.getByText('Horneado').closest('.space-y-2') as HTMLElement;
    const buttons = within(bakingCard).getAllByRole('button');
    await user.click(buttons[buttons.length - 1]); // la X de la línea
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toEqual({ baking: [], assembling: [] });
  });

  it('shows an error toast and an empty draft when loading fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup({ load: vi.fn().mockRejectedValue(new Error('boom')) });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar la receta'));
    expect(screen.getAllByText('No consume materiales en esta etapa.')).toHaveLength(2);
  });
});

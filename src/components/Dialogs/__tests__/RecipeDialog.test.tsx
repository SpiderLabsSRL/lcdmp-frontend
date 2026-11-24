import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeDialog from '../RecipeDialog';
import type { BakedItem, RawMaterial } from '@/types';

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

const doughs: BakedItem[] = [
  {
    id: 'b1', doughTypeId: 'dt-pie', doughTypeName: 'Masa de pie', name: 'Masa de pie · 6 porciones',
    flavor: '', portions: 6, shape: null, quantity: 4, minStock: 0, createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const stages = [
  { key: 'baking', label: 'Horneado' },
  { key: 'assembling', label: 'Armado' },
];

const stage = (over: Partial<{ source: string; materials: any[]; doughs: any[] }> = {}) => ({
  source: 'materials', materials: [], doughs: [], ...over,
}) as any;

function setup(overrides: Partial<React.ComponentProps<typeof RecipeDialog>> = {}) {
  const load = vi.fn().mockResolvedValue({
    baking: stage({ materials: [{ rawMaterialId: 'm1', name: 'Harina', unit: 'kg', quantity: 0.5 }] }),
    assembling: stage(),
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
      doughs={doughs}
      load={load}
      save={save}
      {...overrides}
    />
  );
  return { load, save, onOpenChange };
}

const cardOf = (label: string) => screen.getByText(label).closest('.space-y-3') as HTMLElement;

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

    const assemblingCard = cardOf('Armado');
    await user.click(within(assemblingCard).getByRole('button', { name: /Material/ }));
    await user.click(within(assemblingCard).getByRole('combobox', { name: 'Materia prima' }));
    await user.click(await screen.findByRole('option', { name: 'Huevos (unidad)' }));
    fireEvent.change(within(assemblingCard).getByLabelText('Cantidad'), { target: { value: '2' } });

    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toEqual({
      baking: { source: 'materials', materials: [{ rawMaterialId: 'm1', quantity: 0.5 }], doughs: [] },
      assembling: { source: 'materials', materials: [{ rawMaterialId: 'm2', quantity: 2 }], doughs: [] },
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not save a line without a raw material', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    await screen.findByDisplayValue('0.5');

    await user.click(within(cardOf('Armado')).getByRole('button', { name: /Material/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    expect(save).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Armado: cada material necesita una materia prima y una cantidad mayor a 0');
  });

  it('removes a line', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    await screen.findByDisplayValue('0.5');

    await user.click(within(cardOf('Horneado')).getByRole('button', { name: 'Quitar material' }));
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0].baking.materials).toEqual([]);
  });

  it('shows an error toast and an empty draft when loading fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup({ load: vi.fn().mockRejectedValue(new Error('boom')) });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar la receta'));
    expect(screen.getAllByText('No consume materiales en esta etapa.')).toHaveLength(2);
  });

  describe('etapas que consumen masa horneada', () => {
    it('each stage chooses between raw material and baked dough, starting on raw material', async () => {
      setup();
      await screen.findByDisplayValue('0.5');

      const baking = cardOf('Horneado');
      expect(within(baking).getByRole('button', { name: 'Horneado: usar materia prima' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(baking).getByRole('button', { name: 'Horneado: usar masas horneadas' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('switching a stage to doughs shows the dough picker instead of the materials', async () => {
      const user = userEvent.setup();
      setup();
      await screen.findByDisplayValue('0.5');

      await user.click(screen.getByRole('button', { name: 'Horneado: usar masas horneadas' }));

      const baking = cardOf('Horneado');
      expect(within(baking).queryByRole('combobox', { name: 'Materia prima' })).not.toBeInTheDocument();
      expect(within(baking).getByText('No consume masas horneadas.')).toBeInTheDocument();
      await user.click(within(baking).getByRole('button', { name: /Masa/ }));
      expect(within(baking).getByRole('combobox', { name: 'Masa horneada' })).toBeInTheDocument();
    });

    it('saves the dough of a stage, keeping the other stage on raw material', async () => {
      const user = userEvent.setup();
      const { save } = setup();
      await screen.findByDisplayValue('0.5');

      await user.click(screen.getByRole('button', { name: 'Horneado: usar masas horneadas' }));
      const baking = cardOf('Horneado');
      await user.click(within(baking).getByRole('button', { name: /Masa/ }));
      await user.click(within(baking).getByRole('combobox', { name: 'Masa horneada' }));
      await user.click(await screen.findByRole('option', { name: 'Masa de pie · 6 porciones' }));
      fireEvent.change(within(baking).getByLabelText('Cantidad de masa'), { target: { value: '0.5' } });

      await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

      await waitFor(() => expect(save).toHaveBeenCalled());
      expect(save.mock.calls[0][0].baking).toEqual({
        source: 'doughs',
        materials: [{ rawMaterialId: 'm1', quantity: 0.5 }],
        doughs: [{ bakedProductId: 'b1', quantity: 0.5 }],
      });
      expect(save.mock.calls[0][0].assembling.source).toBe('materials');
    });

    it('does not save a dough line without a dough chosen', async () => {
      const user = userEvent.setup();
      const { save } = setup();
      await screen.findByDisplayValue('0.5');

      await user.click(screen.getByRole('button', { name: 'Horneado: usar masas horneadas' }));
      await user.click(within(cardOf('Horneado')).getByRole('button', { name: /Masa/ }));
      await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

      expect(save).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Horneado: cada masa necesita una masa elegida y una cantidad mayor a 0');
    });

    it('a stage loaded as doughs comes back selected on doughs', async () => {
      const load = vi.fn().mockResolvedValue({
        baking: stage({ source: 'doughs', doughs: [{ bakedProductId: 'b1', name: 'Masa de pie · 6 porciones', quantity: 1 }] }),
        assembling: stage(),
      });
      setup({ load });

      await waitFor(() => expect(load).toHaveBeenCalled());
      expect(await screen.findByRole('combobox', { name: 'Masa horneada' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Horneado: usar masas horneadas' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('tells the user when there are no doughs registered yet', async () => {
      const user = userEvent.setup();
      setup({ doughs: [] });
      await screen.findByDisplayValue('0.5');

      await user.click(screen.getByRole('button', { name: 'Horneado: usar masas horneadas' }));

      expect(within(cardOf('Horneado')).getByText(/No hay masas en el inventario todav/)).toBeInTheDocument();
    });
  });
});

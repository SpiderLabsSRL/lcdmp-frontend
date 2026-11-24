import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix Select/Dialog usan ResizeObserver y pointer capture, que jsdom no implementa.
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from 'sonner';
import { CakeRecipesDialog, FlavorRecipeDialog } from '../DoughRecipeDialogs';
import type { DoughType, Flavor, RawMaterial } from '@/types';
import type { DoughRecipe } from '@/api/MaterialsApi';

const rawMaterials: RawMaterial[] = [
  { id: 'm1', name: 'Harina', unit: 'kg', quantity: 50, minStock: 5, category: 'flour', lastUpdated: new Date() },
  { id: 'm2', name: 'Huevos', unit: 'unidad', quantity: 100, minStock: 10, category: 'eggs', lastUpdated: new Date() },
];

const cakeType: DoughType = {
  id: 'dt-cake', name: 'Masa de torta', usesPortions: true, usesShape: true, usesFlavor: true,
  isCake: true, isActive: true, isCuttable: false, unitName: null, defaultPortions: null,
};
const pieType: DoughType = {
  id: 'dt-pie', name: 'Masa de pie', usesPortions: true, usesShape: false, usesFlavor: false,
  isCake: false, isActive: true, isCuttable: false, unitName: null, defaultPortions: null,
};
const cookieType: DoughType = {
  id: 'dt-cookie', name: 'Galleta', usesPortions: false, usesShape: false, usesFlavor: true,
  isCake: false, isActive: true, isCuttable: false, unitName: null, defaultPortions: null,
};

const recipe = (over: Partial<DoughRecipe> = {}): DoughRecipe => ({
  id: 'dr1', doughTypeId: 'dt-cake', doughTypeName: 'Masa de torta',
  usesPortions: true, usesFlavor: true, isCake: true,
  flavor: null, basePortions: 20,
  materials: [{ rawMaterialId: 'm1', name: 'Harina', unit: 'kg', quantity: 2 }],
  ...over,
});

const buildMaterialsApi = (over: any = {}) => ({
  getDoughRecipes: vi.fn().mockResolvedValue([]),
  saveDoughRecipe: vi.fn().mockResolvedValue([]),
  getCakeRecipe: vi.fn().mockResolvedValue({ assembling: [] }),
  saveCakeRecipe: vi.fn().mockResolvedValue({}),
  ...over,
} as any);

const buildBakedApi = (types: DoughType[] = [cakeType, pieType]) => ({
  getDoughTypes: vi.fn().mockResolvedValue(types),
} as any);

beforeEach(() => vi.clearAllMocks());

describe('CakeRecipesDialog', () => {
  const setup = (materialsApi = buildMaterialsApi(), bakedApi = buildBakedApi()) => {
    const onOpenChange = vi.fn();
    render(
      <CakeRecipesDialog
        open
        onOpenChange={onOpenChange}
        rawMaterials={rawMaterials}
        materialsApi={materialsApi}
        bakedApi={bakedApi}
      />
    );
    return { materialsApi, bakedApi, onOpenChange };
  };

  const cardOf = (name: string) => screen.getByText(name).closest('.space-y-3') as HTMLElement;

  it('lists one dough recipe per active dough type, plus the cake assembling recipe', async () => {
    setup();

    expect(await screen.findByText('Horneado — recetas de masas')).toBeInTheDocument();
    expect(screen.getByText('Masa de torta')).toBeInTheDocument();
    expect(screen.getByText('Masa de pie')).toBeInTheDocument();
    expect(screen.getByText('Armado')).toBeInTheDocument();
    expect(screen.getByText('Cantidad por cada 10 porciones de torta.')).toBeInTheDocument();
  });

  it('leaves out the deactivated types', async () => {
    setup(buildMaterialsApi(), buildBakedApi([cakeType, { ...pieType, isActive: false }]));

    await screen.findByText('Masa de torta');
    expect(screen.queryByText('Masa de pie')).not.toBeInTheDocument();
  });

  it('prefills the base portions and the materials of each recipe', async () => {
    setup(buildMaterialsApi({ getDoughRecipes: vi.fn().mockResolvedValue([recipe()]) }));

    await screen.findByText('Masa de torta');
    const card = cardOf('Masa de torta');
    expect(within(card).getByLabelText('Receta base para (porciones)')).toHaveValue(20);
    expect(within(card).getByDisplayValue('2')).toBeInTheDocument();
  });

  it('a type that does not use portions has no base portions field', async () => {
    setup(buildMaterialsApi(), buildBakedApi([cookieType]));

    await screen.findByText('Galleta');
    expect(screen.queryByLabelText('Receta base para (porciones)')).not.toBeInTheDocument();
  });

  it('saves a dough recipe with its base portions and the cake assembling recipe', async () => {
    const user = userEvent.setup();
    const { materialsApi, onOpenChange } = setup(buildMaterialsApi(), buildBakedApi([cakeType]));
    await screen.findByText('Masa de torta');

    const card = cardOf('Masa de torta');
    fireEvent.change(within(card).getByLabelText('Receta base para (porciones)'), { target: { value: '20' } });
    await user.click(within(card).getByRole('button', { name: /Material/ }));
    await user.click(within(card).getByRole('combobox', { name: 'Materia prima' }));
    await user.click(await screen.findByRole('option', { name: 'Harina (kg)' }));
    fireEvent.change(within(card).getByLabelText('Cantidad'), { target: { value: '2.5' } });

    await user.click(screen.getByRole('button', { name: 'Guardar recetas' }));

    await waitFor(() => expect(materialsApi.saveDoughRecipe).toHaveBeenCalledWith({
      doughTypeId: 'dt-cake', basePortions: 20, materials: [{ rawMaterialId: 'm1', quantity: 2.5 }],
    }));
    expect(materialsApi.saveCakeRecipe).toHaveBeenCalledWith({ assembling: [] });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not send a type that has no recipe and no materials', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup(buildMaterialsApi(), buildBakedApi([cakeType, pieType]));
    await screen.findByText('Masa de pie');

    await user.click(screen.getByRole('button', { name: 'Guardar recetas' }));

    await waitFor(() => expect(materialsApi.saveCakeRecipe).toHaveBeenCalled());
    expect(materialsApi.saveDoughRecipe).not.toHaveBeenCalled();
  });

  it('sends a type whose recipe was emptied, so it gets deleted', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup(
      buildMaterialsApi({ getDoughRecipes: vi.fn().mockResolvedValue([recipe()]) }),
      buildBakedApi([cakeType])
    );
    await screen.findByText('Masa de torta');

    await user.click(within(cardOf('Masa de torta')).getByRole('button', { name: 'Quitar material' }));
    await user.click(screen.getByRole('button', { name: 'Guardar recetas' }));

    await waitFor(() => expect(materialsApi.saveDoughRecipe).toHaveBeenCalledWith({
      doughTypeId: 'dt-cake', basePortions: 20, materials: [],
    }));
  });

  it('requires the base portions when the recipe has materials', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup(buildMaterialsApi(), buildBakedApi([cakeType]));
    await screen.findByText('Masa de torta');

    const card = cardOf('Masa de torta');
    await user.click(within(card).getByRole('button', { name: /Material/ }));
    await user.click(within(card).getByRole('combobox', { name: 'Materia prima' }));
    await user.click(await screen.findByRole('option', { name: 'Harina (kg)' }));

    await user.click(screen.getByRole('button', { name: 'Guardar recetas' }));

    expect(toast.error).toHaveBeenCalledWith('Masa de torta: indica para cuántas porciones es la receta');
    expect(materialsApi.saveDoughRecipe).not.toHaveBeenCalled();
  });

  it('explains that a flavor recipe overrides the cake dough base one', async () => {
    setup(buildMaterialsApi(), buildBakedApi([cakeType]));

    expect(await screen.findByText(/manda la del sabor/)).toBeInTheDocument();
  });

  it('shows an error when the recipes cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup(buildMaterialsApi({ getDoughRecipes: vi.fn().mockRejectedValue(new Error('boom')) }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar las recetas'));
  });
});

describe('FlavorRecipeDialog', () => {
  const flavor: Flavor = { id: 'f1', name: 'Chocolate', type: 'cake', isActive: true };

  const setup = (materialsApi = buildMaterialsApi(), bakedApi = buildBakedApi([cakeType])) => {
    const onClose = vi.fn();
    render(
      <FlavorRecipeDialog
        flavor={flavor}
        rawMaterials={rawMaterials}
        materialsApi={materialsApi}
        bakedApi={bakedApi}
        onClose={onClose}
      />
    );
    return { materialsApi, onClose };
  };

  it('opens with the flavor name and asks for the base portions', async () => {
    setup();

    expect(await screen.findByText('Receta de masa - Chocolate')).toBeInTheDocument();
    expect(screen.getByLabelText('Receta base para (porciones)')).toBeInTheDocument();
  });

  it('prefills the recipe of that flavor, matching it ignoring case', async () => {
    setup(buildMaterialsApi({
      getDoughRecipes: vi.fn().mockResolvedValue([recipe({ id: 'dr2', flavor: 'chocolate', basePortions: 10 })]),
    }));

    await screen.findByText('Receta de masa - Chocolate');
    expect(screen.getByLabelText('Receta base para (porciones)')).toHaveValue(10);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('does not take the base recipe of the type as the flavor recipe', async () => {
    setup(buildMaterialsApi({ getDoughRecipes: vi.fn().mockResolvedValue([recipe({ flavor: null })]) }));

    await screen.findByText('Receta de masa - Chocolate');
    expect(screen.getByLabelText('Receta base para (porciones)')).toHaveValue(null);
    expect(await screen.findByText(/Sin receta propia se usa la receta base/)).toBeInTheDocument();
  });

  it('saves the recipe for that flavor', async () => {
    const user = userEvent.setup();
    const { materialsApi, onClose } = setup();
    await screen.findByText('Receta de masa - Chocolate');

    fireEvent.change(screen.getByLabelText('Receta base para (porciones)'), { target: { value: '15' } });
    await user.click(screen.getByRole('button', { name: /Material/ }));
    await user.click(screen.getByRole('combobox', { name: 'Materia prima' }));
    await user.click(await screen.findByRole('option', { name: 'Huevos (unidad)' }));
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '6' } });

    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(materialsApi.saveDoughRecipe).toHaveBeenCalledWith({
      doughTypeId: 'dt-cake', flavor: 'Chocolate', basePortions: 15, materials: [{ rawMaterialId: 'm2', quantity: 6 }],
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('saving it empty removes the flavor recipe and falls back to the base one', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup(buildMaterialsApi({
      getDoughRecipes: vi.fn().mockResolvedValue([recipe({ flavor: 'Chocolate' })]),
    }));
    await screen.findByText('Receta de masa - Chocolate');

    await user.click(screen.getByRole('button', { name: 'Quitar material' }));
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(materialsApi.saveDoughRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ flavor: 'Chocolate', materials: [] })
    ));
    expect(toast.success).toHaveBeenCalledWith('Receta quitada: se usará la base de la masa');
  });

  it('requires the base portions when there are materials', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup();
    await screen.findByText('Receta de masa - Chocolate');

    await user.click(screen.getByRole('button', { name: /Material/ }));
    await user.click(screen.getByRole('combobox', { name: 'Materia prima' }));
    await user.click(await screen.findByRole('option', { name: 'Harina (kg)' }));
    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    expect(toast.error).toHaveBeenCalledWith('Indica para cuántas porciones es la receta');
    expect(materialsApi.saveDoughRecipe).not.toHaveBeenCalled();
  });

  it('refuses to save when there is no cake dough type registered', async () => {
    const user = userEvent.setup();
    const { materialsApi } = setup(buildMaterialsApi(), buildBakedApi([pieType]));
    await screen.findByText('Receta de masa - Chocolate');

    await user.click(screen.getByRole('button', { name: 'Guardar receta' }));

    expect(toast.error).toHaveBeenCalledWith('No hay un tipo de masa de torta registrado');
    expect(materialsApi.saveDoughRecipe).not.toHaveBeenCalled();
  });
});

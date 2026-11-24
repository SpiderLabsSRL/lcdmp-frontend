import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaterialLines, type MaterialLine } from '@/components/Dialogs/RecipeLines';
import type { IMaterialsApi, DoughRecipe } from '@/api/MaterialsApi';
import type { IBakedApi } from '@/api/BakedApi';
import type { DoughType, Flavor, RawMaterial } from '@/types';

interface DoughDraft {
  basePortions: number;
  materials: MaterialLine[];
  // Ya tenía receta guardada: hay que mandarla igual aunque quede vacía, para borrarla
  hadRecipe: boolean;
}

const toDraft = (recipe?: DoughRecipe): DoughDraft => ({
  basePortions: recipe?.basePortions ?? 0,
  materials: (recipe?.materials || []).map(({ rawMaterialId, quantity }) => ({ rawMaterialId, quantity })),
  hadRecipe: !!recipe,
});

// Porciones base + materiales de una receta de masa.
function DoughRecipeFields({
  draft, usesPortions, rawMaterials, onChange, idPrefix,
}: {
  draft: DoughDraft;
  usesPortions: boolean;
  rawMaterials: RawMaterial[];
  onChange: (draft: DoughDraft) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      {usesPortions && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-portions`} className="text-sm">Receta base para (porciones)</Label>
          <NumberInput
            id={`${idPrefix}-portions`}
            value={draft.basePortions || undefined}
            fallback={0}
            placeholder="Ej: 20"
            className="sm:w-40"
            onChange={v => onChange({ ...draft, basePortions: v })}
          />
          <p className="text-xs text-muted-foreground">
            Si se hornea otra cantidad de porciones, la receta se ajusta en proporción.
          </p>
        </div>
      )}
      <MaterialLines
        lines={draft.materials}
        rawMaterials={rawMaterials}
        onChange={materials => onChange({ ...draft, materials })}
      />
    </div>
  );
}

interface CakeRecipesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawMaterials: RawMaterial[];
  materialsApi: IMaterialsApi;
  bakedApi: IBakedApi;
}

// Horneado: la receta de cada tipo de masa (lo que de verdad se hornea). Armado: la receta de la
// torta, que no depende del sabor.
export function CakeRecipesDialog({ open, onOpenChange, rawMaterials, materialsApi, bakedApi }: CakeRecipesDialogProps) {
  const [types, setTypes] = useState<DoughType[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DoughDraft>>({});
  const [assembling, setAssembling] = useState<MaterialLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([bakedApi.getDoughTypes(), materialsApi.getDoughRecipes(), materialsApi.getCakeRecipe()])
      .then(([doughTypes, recipes, cakeRecipe]) => {
        if (cancelled) return;
        const active = doughTypes.filter(t => t.isActive);
        setTypes(active);
        setDrafts(Object.fromEntries(active.map(t => [
          t.id,
          toDraft(recipes.find(r => r.doughTypeId === t.id && r.flavor === null)),
        ])));
        setAssembling((cakeRecipe.assembling || []).map(({ rawMaterialId, quantity }) => ({ rawMaterialId, quantity })));
      })
      .catch((error) => {
        console.error('Error loading recipes:', error);
        toast.error('Error al cargar las recetas');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    const pending = types.filter(t => drafts[t.id] && (drafts[t.id].materials.length > 0 || drafts[t.id].hadRecipe));

    for (const type of pending) {
      const draft = drafts[type.id];
      if (draft.materials.some(l => !l.rawMaterialId || !(l.quantity > 0))) {
        toast.error(`${type.name}: cada material necesita una materia prima y una cantidad mayor a 0`);
        return;
      }
      if (type.usesPortions && draft.materials.length > 0 && !(draft.basePortions > 0)) {
        toast.error(`${type.name}: indica para cuántas porciones es la receta`);
        return;
      }
    }
    if (assembling.some(l => !l.rawMaterialId || !(l.quantity > 0))) {
      toast.error('Armado: cada material necesita una materia prima y una cantidad mayor a 0');
      return;
    }

    setSaving(true);
    try {
      for (const type of pending) {
        const draft = drafts[type.id];
        await materialsApi.saveDoughRecipe({
          doughTypeId: type.id,
          basePortions: type.usesPortions ? draft.basePortions : null,
          materials: draft.materials,
        });
      }
      await materialsApi.saveCakeRecipe({ assembling });
      toast.success('Recetas guardadas');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar las recetas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-xl rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Receta de tortas</DialogTitle>
          <DialogDescription>
            El horneado descuenta la receta de la masa; el armado, la de la torta. La decoración se
            registra a mano en cada pedido.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm py-4 text-center">Cargando recetas...</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">Horneado — recetas de masas</p>
                <p className="text-xs text-muted-foreground">
                  Una receta por tipo de masa. Se descuenta cada vez que se hornea esa masa, sea una
                  tanda suelta o el horneado de un pedido.
                </p>
              </div>

              {types.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay tipos de masa. Créalos en Inventario → Tipos de masa.
                </p>
              )}

              {types.map(type => (
                <div key={type.id} className="border rounded-lg p-3 space-y-3">
                  <p className="font-medium text-sm">{type.name}</p>
                  <DoughRecipeFields
                    draft={drafts[type.id] || toDraft()}
                    usesPortions={type.usesPortions}
                    rawMaterials={rawMaterials}
                    idPrefix={`dough-${type.id}`}
                    onChange={draft => setDrafts(d => ({ ...d, [type.id]: draft }))}
                  />
                  {type.isCake && (
                    <p className="text-xs text-muted-foreground">
                      Esta es la receta base de la masa de torta. Un sabor puede tener la suya en
                      Sabores de Torta, y en ese caso manda la del sabor.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div>
                <p className="font-medium text-sm">Armado</p>
                <p className="text-xs text-muted-foreground">Cantidad por cada 10 porciones de torta.</p>
              </div>
              <MaterialLines lines={assembling} rawMaterials={rawMaterials} onChange={setAssembling} />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar recetas
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FlavorRecipeDialogProps {
  flavor: Flavor | null;
  rawMaterials: RawMaterial[];
  materialsApi: IMaterialsApi;
  bakedApi: IBakedApi;
  onClose: () => void;
}

// Receta de la masa de torta de un sabor. Sin receta propia se usa la base del tipo de masa.
export function FlavorRecipeDialog({ flavor, rawMaterials, materialsApi, bakedApi, onClose }: FlavorRecipeDialogProps) {
  const [cakeType, setCakeType] = useState<DoughType | null>(null);
  const [draft, setDraft] = useState<DoughDraft>(toDraft());
  const [hasBase, setHasBase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!flavor) return;
    let cancelled = false;
    setLoading(true);
    setDraft(toDraft());
    Promise.all([bakedApi.getDoughTypes(), materialsApi.getDoughRecipes()])
      .then(([types, recipes]) => {
        if (cancelled) return;
        const type = types.find(t => t.isCake) || null;
        setCakeType(type);
        if (!type) return;
        setDraft(toDraft(recipes.find(r => r.doughTypeId === type.id && r.flavor?.toLowerCase() === flavor.name.toLowerCase())));
        setHasBase(recipes.some(r => r.doughTypeId === type.id && r.flavor === null));
      })
      .catch((error) => {
        console.error('Error loading dough recipes:', error);
        toast.error('Error al cargar la receta');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flavor]);

  const handleSave = async () => {
    if (!cakeType) {
      toast.error('No hay un tipo de masa de torta registrado');
      return;
    }
    if (draft.materials.some(l => !l.rawMaterialId || !(l.quantity > 0))) {
      toast.error('Cada material necesita una materia prima y una cantidad mayor a 0');
      return;
    }
    if (cakeType.usesPortions && draft.materials.length > 0 && !(draft.basePortions > 0)) {
      toast.error('Indica para cuántas porciones es la receta');
      return;
    }

    setSaving(true);
    try {
      await materialsApi.saveDoughRecipe({
        doughTypeId: cakeType.id,
        flavor: flavor!.name,
        basePortions: cakeType.usesPortions ? draft.basePortions : null,
        materials: draft.materials,
      });
      toast.success(draft.materials.length > 0 ? 'Receta guardada' : 'Receta quitada: se usará la base de la masa');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!flavor} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Receta de masa - {flavor?.name}</DialogTitle>
          <DialogDescription>
            Materia prima de la masa de este sabor. Se descuenta cada vez que se hornea.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm py-4 text-center">Cargando receta...</p>
        ) : (
          <div className="space-y-4">
            <DoughRecipeFields
              draft={draft}
              usesPortions={cakeType?.usesPortions ?? true}
              rawMaterials={rawMaterials}
              idPrefix="flavor"
              onChange={setDraft}
            />

            <p className="text-xs text-muted-foreground">
              {draft.materials.length === 0 && hasBase
                ? 'Sin receta propia se usa la receta base de la masa de torta (Receta de tortas).'
                : 'Esta receta manda sobre la base de la masa de torta.'}
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar receta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

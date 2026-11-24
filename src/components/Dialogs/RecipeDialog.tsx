import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoughLines, MaterialLines } from '@/components/Dialogs/RecipeLines';
import type { BakedItem, RawMaterial } from '@/types';
import type { ProductRecipe, StageRecipe } from '@/api/MaterialsApi';

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  stages: { key: string; label: string }[];
  rawMaterials: RawMaterial[];
  doughs: BakedItem[];
  load: () => Promise<ProductRecipe>;
  save: (recipe: ProductRecipe) => Promise<ProductRecipe>;
}

const emptyStage = (): StageRecipe => ({ source: 'materials', materials: [], doughs: [] });

// Editor de la receta de un producto. Cada etapa usa materia prima O masas horneadas, nunca las
// dos: así la lista no mezcla el inventario entero con el de masas.
export default function RecipeDialog({
  open, onOpenChange, title, description, stages, rawMaterials, doughs, load, save,
}: RecipeDialogProps) {
  const [draft, setDraft] = useState<ProductRecipe>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    load()
      .then((recipe) => {
        if (cancelled) return;
        setDraft(Object.fromEntries(stages.map(({ key }) => {
          const entry = recipe[key];
          return [key, {
            source: entry?.source === 'doughs' ? 'doughs' : 'materials',
            materials: (entry?.materials || []).map(({ rawMaterialId, quantity }) => ({ rawMaterialId, quantity })),
            doughs: (entry?.doughs || []).map(({ bakedProductId, quantity }) => ({ bakedProductId, quantity })),
          } as StageRecipe];
        })));
      })
      .catch((error) => {
        console.error('Error loading recipe:', error);
        toast.error('Error al cargar la receta');
        setDraft(Object.fromEntries(stages.map(({ key }) => [key, emptyStage()])));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // load/stages cambian de identidad en cada render del padre; solo importa al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patchStage = (stage: string, change: Partial<StageRecipe>) =>
    setDraft(d => ({ ...d, [stage]: { ...(d[stage] || emptyStage()), ...change } }));

  const handleSave = async () => {
    for (const { key, label } of stages) {
      const entry = draft[key] || emptyStage();
      if (entry.source === 'doughs') {
        if (entry.doughs.some(l => !l.bakedProductId || !(l.quantity > 0))) {
          toast.error(`${label}: cada masa necesita una masa elegida y una cantidad mayor a 0`);
          return;
        }
      } else if (entry.materials.some(l => !l.rawMaterialId || !(l.quantity > 0))) {
        toast.error(`${label}: cada material necesita una materia prima y una cantidad mayor a 0`);
        return;
      }
    }

    setSaving(true);
    try {
      await save(draft);
      toast.success('Receta guardada');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-xl rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {loading ? (
          <p className="text-sm py-4 text-center">Cargando receta...</p>
        ) : (
          <div className="space-y-4">
            {stages.map(({ key, label }) => {
              const entry = draft[key] || emptyStage();
              return (
                <div key={key} className="border rounded-lg p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="font-medium text-sm">{label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={entry.source === 'materials' ? 'default' : 'outline'}
                        aria-pressed={entry.source === 'materials'}
                        aria-label={`${label}: usar materia prima`}
                        onClick={() => patchStage(key, { source: 'materials' })}
                      >
                        Materia prima
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={entry.source === 'doughs' ? 'default' : 'outline'}
                        aria-pressed={entry.source === 'doughs'}
                        aria-label={`${label}: usar masas horneadas`}
                        onClick={() => patchStage(key, { source: 'doughs' })}
                      >
                        Masas horneadas
                      </Button>
                    </div>
                  </div>

                  {entry.source === 'doughs' ? (
                    <DoughLines
                      lines={entry.doughs}
                      doughs={doughs}
                      onChange={lines => patchStage(key, { doughs: lines })}
                    />
                  ) : (
                    <MaterialLines
                      lines={entry.materials}
                      rawMaterials={rawMaterials}
                      onChange={lines => patchStage(key, { materials: lines })}
                      emptyText="No consume materiales en esta etapa."
                    />
                  )}
                </div>
              );
            })}

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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

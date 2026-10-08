import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RawMaterial } from '@/types';
import type { Recipe } from '@/api/MaterialsApi';

interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  stages: { key: string; label: string }[];
  rawMaterials: RawMaterial[];
  load: () => Promise<Recipe>;
  save: (recipe: Recipe) => Promise<Recipe>;
}

type Draft = Record<string, { rawMaterialId: string; quantity: number }[]>;

// Editor de receta por etapa: una lista de (materia prima, cantidad) por etapa.
// Las cantidades están siempre en la unidad de la materia prima elegida.
export default function RecipeDialog({ open, onOpenChange, title, description, stages, rawMaterials, load, save }: RecipeDialogProps) {
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    load()
      .then((recipe) => {
        if (cancelled) return;
        setDraft(Object.fromEntries(stages.map(({ key }) => [
          key,
          (recipe[key] || []).map(({ rawMaterialId, quantity }) => ({ rawMaterialId, quantity })),
        ])));
      })
      .catch((error) => {
        console.error('Error loading recipe:', error);
        toast.error('Error al cargar la receta');
        setDraft(Object.fromEntries(stages.map(({ key }) => [key, []])));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // load/stages cambian de identidad en cada render del padre; solo importa al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unitOf = (id: string) => rawMaterials.find(m => m.id === id)?.unit;

  const updateLine = (stage: string, index: number, patch: Partial<Draft[string][number]>) =>
    setDraft(d => ({ ...d, [stage]: d[stage].map((line, i) => (i === index ? { ...line, ...patch } : line)) }));

  const handleSave = async () => {
    const lines = Object.values(draft).flat();
    if (lines.some(l => !l.rawMaterialId || !(l.quantity > 0))) {
      toast.error('Cada material necesita una materia prima y una cantidad mayor a 0');
      return;
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
            {stages.map(({ key, label }) => (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{label}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft(d => ({ ...d, [key]: [...(d[key] || []), { rawMaterialId: '', quantity: 1 }] }))}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Material
                  </Button>
                </div>

                {(draft[key] || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No consume materiales en esta etapa.</p>
                )}

                {(draft[key] || []).map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                    <Select value={line.rawMaterialId} onValueChange={(v) => updateLine(key, index, { rawMaterialId: v })}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Materia prima" />
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <NumberInput
                        decimal
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(v) => updateLine(key, index, { quantity: v })}
                        fallback={1}
                        aria-label="Cantidad"
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground w-8">{unitOf(line.rawMaterialId)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDraft(d => ({ ...d, [key]: d[key].filter((_, i) => i !== index) }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ))}

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

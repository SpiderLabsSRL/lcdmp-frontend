import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RawMaterial } from '@/types';
import { IMaterialsApi, MaterialMovement, defaultMaterialsApi } from '@/api/MaterialsApi';
import { IInventoryApi, defaultInventoryApi } from '@/api/InventoryApi';

const STAGE_LABEL: Record<MaterialMovement['stage'], string> = {
  baking: 'Horneado',
  assembling: 'Armado',
  decorating: 'Decoración',
  restock: 'Reposición',
};

interface MaterialUsageSectionProps {
  orderId: string;
  // Registrar material a mano (decoración libre) solo tiene sentido en un pedido vivo.
  canRegister: boolean;
  materialsApi?: IMaterialsApi;
  inventoryApi?: IInventoryApi;
}

// Materiales gastados por un pedido: los automáticos (receta, al completar etapas) y los
// que se registran a mano para la decoración, que cambia en cada pedido.
export default function MaterialUsageSection({
  orderId,
  canRegister,
  materialsApi = defaultMaterialsApi,
  inventoryApi = defaultInventoryApi,
}: MaterialUsageSectionProps) {
  const [open, setOpen] = useState(false);
  const [movements, setMovements] = useState<MaterialMovement[] | null>(null);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMovements = async () => {
    setLoading(true);
    try {
      setMovements(await materialsApi.getMovements({ orderId }));
    } catch (error) {
      console.error('Error loading material movements:', error);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && movements === null) {
      await loadMovements();
      if (canRegister) {
        inventoryApi.getRawMaterials().then(setRawMaterials).catch((e) => console.error('Error loading raw materials:', e));
      }
    }
  };

  const handleRegister = async () => {
    if (!materialId || !(quantity > 0)) {
      toast.error('Elige una materia prima y una cantidad mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await materialsApi.registerUsage({ orderId, rawMaterialId: materialId, quantity, notes: notes.trim() || undefined });
      toast.success('Material registrado');
      setMaterialId('');
      setQuantity(1);
      setNotes('');
      await loadMovements();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el material');
    } finally {
      setSaving(false);
    }
  };

  const unit = rawMaterials.find(m => m.id === materialId)?.unit;

  return (
    <div className="border-t pt-3 sm:pt-4">
      <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" onClick={toggle}>
        <span className="flex items-center gap-2 font-semibold text-base text-foreground">
          <Package className="h-4 w-4" />
          Materiales usados
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-sm text-foreground">Cargando materiales...</p>
          ) : !movements || movements.length === 0 ? (
            <p className="text-sm text-foreground">Sin materiales registrados todavía.</p>
          ) : (
            movements.map(m => (
              <div key={m.id} className="bg-muted/50 p-3 rounded-lg text-sm text-foreground">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-medium">{m.materialName}</span>
                  <span className="font-medium">{m.quantity} {m.unit}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline">{STAGE_LABEL[m.stage]}</Badge>
                  <Badge variant="secondary">{m.source === 'manual' ? 'Manual' : 'Receta'}</Badge>
                  <span>{format(new Date(m.createdAt), 'dd MMM HH:mm', { locale: es })}</span>
                  {m.createdByName && <span>— {m.createdByName}</span>}
                </div>
                {m.notes && <p className="mt-1">{m.notes}</p>}
              </div>
            ))
          )}

          {canRegister && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">Registrar materiales de decoración</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <Select value={materialId} onValueChange={setMaterialId}>
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
                    value={quantity}
                    onChange={setQuantity}
                    fallback={1}
                    aria-label="Cantidad usada"
                    className="text-sm"
                  />
                  <span className="text-xs text-muted-foreground w-8">{unit}</span>
                </div>
              </div>
              <Input
                placeholder="Notas (opcional)"
                className="text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button type="button" size="sm" onClick={handleRegister} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

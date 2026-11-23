import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumberInput } from '@/components/ui/number-input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BakedItemFields, emptyBakedItemDraft, toBakedItemSpec, validateBakedItemDraft, type BakedItemDraft } from './BakedItemFields';
import type { IBakedApi } from '@/api/BakedApi';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { BakedItem, DoughType } from '@/types';

interface BakedBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bakedApi: IBakedApi;
  ordersApi?: IOrdersApi;
  onSaved: (item: BakedItem) => void;
}

// Registro libre de una tanda horneada (galletas, masa de pie, conitos, masas de torta...), sin
// depender de un pedido. Entra al inventario de masas.
export function BakedBatchDialog({ open, onOpenChange, bakedApi, ordersApi, onSaved }: BakedBatchDialogProps) {
  const [doughTypes, setDoughTypes] = useState<DoughType[]>([]);
  const [draft, setDraft] = useState<BakedItemDraft>(emptyBakedItemDraft);
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyBakedItemDraft);
    setQuantity(0);
    setNotes('');
    bakedApi.getDoughTypes()
      .then(setDoughTypes)
      .catch(() => toast.error('Error al cargar los tipos de masa'));
  }, [open, bakedApi]);

  const handleSave = async () => {
    const type = doughTypes.find(t => t.id === draft.doughTypeId);
    const problem = validateBakedItemDraft(draft, type) || (quantity > 0 ? null : 'Indica cuántas unidades se hornearon');
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const item = await bakedApi.addBatch({ ...toBakedItemSpec(draft, type), quantity, notes: notes.trim() || undefined });
      toast.success(`Horneado registrado: ${item.name} (stock ${item.quantity})`);
      onSaved(item);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el horneado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !saving && onOpenChange(next)}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Registrar masas horneadas</DialogTitle>
          <DialogDescription>Entran al inventario de masas horneadas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1">
          <BakedItemFields doughTypes={doughTypes} value={draft} onChange={setDraft} ordersApi={ordersApi} />

          <div className="space-y-1.5">
            <Label htmlFor="baked-quantity" className="text-sm">Cantidad horneada (unidades) *</Label>
            <NumberInput id="baked-quantity" value={quantity || undefined} fallback={0} placeholder="0" onChange={setQuantity} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baked-notes" className="text-sm">Notas (opcional)</Label>
            <Textarea id="baked-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

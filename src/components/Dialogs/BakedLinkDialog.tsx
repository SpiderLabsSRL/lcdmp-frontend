import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BakedItemFields,
  emptyBakedItemDraft,
  toBakedItemSpec,
  validateBakedItemDraft,
  type BakedItemDraft,
} from '@/components/Inventory/BakedItemFields';
import type { IBakedApi } from '@/api/BakedApi';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { DoughType, Product } from '@/types';

interface BakedLinkDialogProps {
  product: Product | null;
  bakedApi: IBakedApi;
  ordersApi?: IOrdersApi;
  onClose: () => void;
  // Se llama con el id del ítem vinculado (o null si se quitó el vínculo)
  onSaved: (productId: string, bakedProductId: string | null) => void;
}

// Masa del inventario horneado que genera el horneado de un producto del catálogo y que consume su
// armado. Sin vínculo, el producto no mueve el inventario de masas.
export function BakedLinkDialog({ product, bakedApi, ordersApi, onClose, onSaved }: BakedLinkDialogProps) {
  const [doughTypes, setDoughTypes] = useState<DoughType[]>([]);
  const [draft, setDraft] = useState<BakedItemDraft>(emptyBakedItemDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setDraft(emptyBakedItemDraft);
    let cancelled = false;
    (async () => {
      try {
        const [types, items] = await Promise.all([bakedApi.getDoughTypes(), bakedApi.getItems()]);
        if (cancelled) return;
        setDoughTypes(types);
        const current = items.find(i => i.id === product.bakedProductId);
        if (current) {
          setDraft({ doughTypeId: current.doughTypeId, flavor: current.flavor, portions: current.portions ?? 0, shape: current.shape ?? '', whole: current.portions === null });
        }
      } catch {
        if (!cancelled) toast.error('Error al cargar las masas');
      }
    })();
    return () => { cancelled = true; };
  }, [product, bakedApi]);

  const save = async (clear: boolean) => {
    if (!product) return;
    const type = doughTypes.find(t => t.id === draft.doughTypeId);
    if (!clear) {
      const problem = validateBakedItemDraft(draft, type);
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setSaving(true);
    try {
      const item = await bakedApi.setProductLink(product.id, clear ? null : toBakedItemSpec(draft, type));
      onSaved(product.id, clear ? null : item?.id ?? null);
      toast.success(clear ? 'Vínculo quitado' : 'Masa vinculada');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al vincular la masa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Masa horneada - {product?.name}</DialogTitle>
          <DialogDescription>
            Al completar el horneado de este producto entra esta masa al inventario (por la cantidad del pedido); al completar el armado, sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1">
          <BakedItemFields doughTypes={doughTypes} value={draft} onChange={setDraft} ordersApi={ordersApi} allowPieces />

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {product?.bakedProductId && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => save(true)} disabled={saving}>
                Quitar vínculo
              </Button>
            )}
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={() => save(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

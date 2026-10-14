import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReferenceImages } from '@/components/Images/ReferenceImages';
import type { CustomCake, WorkItem } from '@/types';
import { getCakeShapeLabel } from '@/types/consts';

export const getCakeForItem = (item: WorkItem): CustomCake | undefined => {
  if (item.itemType !== 'custom_cake') return undefined;
  return item.order.customCakes.find(c => c.id === item.itemId);
};

// Línea corta para la tarjeta de una línea de producción: el diseño pedido (recortado)
export function DesignPreview({ item }: { item: WorkItem }) {
  const cake = getCakeForItem(item);
  if (!cake?.design) return null;
  return <p className=" mt-0.5">🎨 {cake.design.substring(0, 100)}{cake.design.length > 100 ? '...' : ''}</p>;
}

interface WorkItemDetailDialogProps {
  item: WorkItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Detalles completos de una línea de producción al tocar su tarjeta: cliente y entrega, diseño
// requerido, dedicatoria, imágenes de referencia, notas de la línea y notas del pedido. Lo usan
// Hornos, Armado y Decoración para que las tres pantallas muestren lo mismo.
export function WorkItemDetailDialog({ item, open, onOpenChange }: WorkItemDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Detalles del Pedido #{item?.order.orderNumber}</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4 px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-foreground">Cliente</p>
                <p className="font-semibold text-base text-foreground">{item.order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-foreground">Fecha de entrega</p>
                <p className="font-semibold text-base text-foreground">
                  {format(new Date(item.order.pickupDate), 'dd MMMM yyyy', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-foreground">Hora</p>
                <p className="font-semibold text-base text-foreground">{item.order.pickupTime}</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-semibold text-base text-foreground">{item.title}</h4>
              {(() => {
                const cake = getCakeForItem(item);
                if (!cake) return null;
                return (
                  <>
                    {cake.shape && (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Forma:</span> {getCakeShapeLabel(cake.shape)}
                      </p>
                    )}
                    {cake.design && (
                      <div className="p-2 sm:p-3 bg-background rounded border">
                        <p className="text-sm font-semibold text-foreground">Diseño requerido:</p>
                        <p className="text-sm mt-1 whitespace-pre-wrap text-foreground">{cake.design}</p>
                      </div>
                    )}
                    {cake.dedication && (
                      <p className="text-sm text-foreground">Dedicatoria: "{cake.dedication}"</p>
                    )}
                    {cake.referenceImages && cake.referenceImages.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold mb-1 text-foreground">Imágenes de referencia:</p>
                        <ReferenceImages images={cake.referenceImages} />
                      </div>
                    )}
                  </>
                );
              })()}
              {item.notes && (
                <p className="text-sm text-foreground">Notas: "{item.notes}"</p>
              )}
            </div>

            {item.order.notes && (
              <div className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-1">
                <p className="text-sm font-semibold text-foreground">📝 Notas del pedido:</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.order.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

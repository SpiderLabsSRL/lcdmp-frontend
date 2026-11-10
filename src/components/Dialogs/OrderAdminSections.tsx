import { useState } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statusConfig } from '@/types/consts';
import { getOrderWorkItems } from '@/utils/workItems';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { ItemStageLogEntry, Order, OrderStatus, ProductStatus, WorkItem } from '@/types';

// Etapas que se pueden poner a mano. 'delivered' y 'cancelled' del pedido completo tienen su
// propio botón (entregar pide el método de pago; cancelar pide confirmación).
const STAGES: ProductStatus[] = ['pending', 'baking', 'assembling', 'decorating', 'ready', 'delivered'];
const ORDER_STAGES: ProductStatus[] = ['pending', 'baking', 'assembling', 'decorating', 'ready'];

const stageLabel = (status?: string) => statusConfig[status as OrderStatus]?.label || status || '';
const stageColor = (status?: string) => statusConfig[status as OrderStatus]?.color || '';

function formatDuration(entry: ItemStageLogEntry): string {
  if (!entry.completedAt) return 'En curso';
  const minutes = differenceInMinutes(new Date(entry.completedAt), new Date(entry.enteredAt));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

export function OrderHistorySection({ orderId, ordersApi }: { orderId: string; ordersApi: IOrdersApi }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<ItemStageLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && log === null) {
      setLoading(true);
      try {
        setLog(await ordersApi.getOrderProductionLog(orderId));
      } catch (error) {
        console.error('Error loading production log:', error);
        setLog([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="border-t pt-3 sm:pt-4">
      <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" onClick={toggle}>
        <span className="flex items-center gap-2 font-semibold text-base text-foreground">
          <History className="h-4 w-4" />
          Historial de producción
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-sm text-foreground">Cargando historial...</p>
          ) : !log || log.length === 0 ? (
            <p className="text-sm text-foreground">Sin historial de producción todavía.</p>
          ) : (
            log.map(entry => (
              <div key={entry.id} className="bg-muted/50 p-3 rounded-lg text-sm text-foreground">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <Badge className={stageColor(entry.stage)}>{stageLabel(entry.stage)}</Badge>
                  <span className="font-medium">{formatDuration(entry)}</span>
                </div>
                <p className="mt-1">Entró: {format(new Date(entry.enteredAt), 'dd MMM HH:mm', { locale: es })}</p>
                {entry.completedAt && (
                  <p>
                    Completado: {format(new Date(entry.completedAt), 'dd MMM HH:mm', { locale: es })}
                    {entry.completedByName && ` — por ${entry.completedByName}`}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface OrderStatusControlsProps {
  order: Order;
  disabled?: boolean;
  onOrderStage: (stage: ProductStatus) => void;
  onItemStage: (item: WorkItem, stage: ProductStatus) => void;
}

// Cambiar a mano la etapa del pedido completo (baja a todas sus líneas) o la de cada línea.
export function OrderStatusControls({ order, disabled, onOrderStage, onItemStage }: OrderStatusControlsProps) {
  const items = getOrderWorkItems(order);
  const orderStageValue = ORDER_STAGES.includes(order.status as ProductStatus) ? order.status : undefined;

  return (
    <div className="border-t pt-3 sm:pt-4 space-y-3">
      <h4 className="font-semibold text-base text-foreground">Cambiar estado</h4>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-foreground">Pedido completo</span>
        <Select value={orderStageValue} onValueChange={v => onOrderStage(v as ProductStatus)} disabled={disabled}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Estado del pedido">
            <SelectValue placeholder={stageLabel(order.status)} />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STAGES.map(s => (
              <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-foreground">Por producto</p>
          {items.map(item => (
            <div key={`${item.itemType}-${item.itemId}`} className="bg-muted/50 p-2 rounded-lg flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-foreground min-w-0 flex-1">{item.title}</span>
              <Select value={item.status} onValueChange={v => onItemStage(item, v as ProductStatus)} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-40" aria-label={`Estado de ${item.title}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { WorkItem } from '@/types';
import { hoursUntilPickupDateTime } from '@/utils/DateUtils';

interface WorkItemCardProps {
  item: WorkItem;
  urgentHours: number;
  soonHours: number;
  completeLabel?: string;
  detail?: ReactNode;
  onComplete: (item: WorkItem) => void;
  onClick?: (item: WorkItem) => void;
}

const getUrgencyBadge = (hoursUntil: number, urgentHours: number, soonHours: number) => {
  if (hoursUntil < urgentHours) return { label: 'Urgente', color: 'bg-red-500' };
  if (hoursUntil < soonHours) return { label: 'Pronto', color: 'bg-orange-500' };
  return { label: 'Normal', color: 'bg-green-500' };
};

// Tarjeta compartida (mobile + desktop) para una línea individual de
// producción (torta/producto/item de combo/extra). Cada pantalla de área
// (Hornos/Armado/Decoración) le pasa su propio contenido de detalle vía
// `detail`, sus umbrales de urgencia, y su acción de completar.
export function WorkItemCard({ item, urgentHours, soonHours, completeLabel = 'Completar', detail, onComplete, onClick }: WorkItemCardProps) {
  const isMobile = useIsMobile();
  const { order } = item;
  const hoursUntil = hoursUntilPickupDateTime(order);
  const urgency = getUrgencyBadge(hoursUntil, urgentHours, soonHours);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete(item);
  };

  if (isMobile) {
    return (
      <MobileCard className="overflow-hidden" onClick={onClick ? () => onClick(item) : undefined}>
        <div className="flex -m-4">
          <div className={`w-1.5 min-h-full ${urgency.color}`} />
          <div className="flex-1 p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-bold text-primary text-sm">#{order.orderNumber}</span>
                <p className="text-sm mt-1">{order.customerName}</p>
              </div>
              <Badge className={`${urgency.color} text-white text-xs`}>{urgency.label}</Badge>
            </div>

            <div className="text-sm bg-muted/50 p-2 rounded mt-2">
              <p className="font-medium">{item.title}</p>
              {detail}
              {item.notes && (
                <p className="text-xs mt-1 whitespace-pre-wrap">📝 {item.notes}</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">{hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}</span>
                <span className="text-xs ml-1">
                  {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                </span>
              </div>
              <Button size="sm" className="h-8 text-xs" onClick={handleComplete}>
                {completeLabel}
                <CheckCircle className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </MobileCard>
    );
  }

  return (
    <div
      className={`flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick ? () => onClick(item) : undefined}
    >
      <div className={`w-2 h-full min-h-16 rounded-full ${urgency.color}`} />

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium">#{order.orderNumber}</span>
          <Badge className={urgency.color}>{urgency.label}</Badge>
        </div>
        <p className="text-sm">{order.customerName}</p>
        <div className="mt-2 space-y-1">
          <p className="text-sm">
            <strong>{item.title}</strong>
          </p>
          {detail}
          {item.notes && (
            <p className="text-sm whitespace-pre-wrap">📝 {item.notes}</p>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className="flex items-center gap-1 mb-2 justify-end">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}</span>
        </div>
        <p className="text-sm font-medium whitespace-nowrap">
          {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
        </p>
      </div>

      <Button size="sm" onClick={handleComplete}>
        <CheckCircle className="h-4 w-4 mr-2" />
        {completeLabel}
      </Button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Palette, AlertTriangle, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IDecorationApi, defaultDecorationApi } from '@/api/DecorationApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import { getWorkItemsAtStage } from '@/utils/workItems';
import { WorkItemCard } from '@/components/Production/WorkItemCard';
import type { Order, WorkItem, CustomCake } from '@/types';

interface DecorationProps {
  decorationApi?: IDecorationApi;
}

export default function Decoration({ decorationApi = defaultDecorationApi }: DecorationProps) {
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [decorationNotes, setDecorationNotes] = useState('');

  // Socket en tiempo real — filtra pedidos con al menos una línea en 'decorating'
  const { orders, isConnected } = useOrdersSocket({
    itemStageFilter: 'decorating',
    initialOrders,
  });

  const decorationItems = getWorkItemsAtStage(orders, 'decorating');

  useEffect(() => {
    loadDecorationOrders();
  }, []);

  const loadDecorationOrders = async () => {
    try {
      setIsLoading(true);
      const orders = await decorationApi.getDecorationOrders();
      setInitialOrders(orders);
    } catch (error) {
      console.error('Error loading decoration orders:', error);
      toast.error('Error al cargar los pedidos de decoración');
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgentItems = () => {
    return decorationItems.filter(i => differenceInHours(new Date(i.order.pickupDate), new Date()) < 6);
  };

  const completeItem = async () => {
    if (!selectedItem) return;

    try {
      await decorationApi.completeItem(selectedItem.order.id, selectedItem.itemType, selectedItem.itemId);

      toast.success('Decoración completada, listo para entrega');

      // Resetear estado — el socket removerá el item de la lista automáticamente
      setIsCompleteDialogOpen(false);
      setSelectedItem(null);
      setDecorationNotes('');
    } catch (error) {
      console.error('Error completing decoration:', error);
      toast.error('Error al completar la decoración');
    }
  };

  const handleViewItem = (item: WorkItem) => {
    setSelectedItem(item);
    setIsDetailDialogOpen(true);
  };

  const handleCompleteItem = (item: WorkItem) => {
    setSelectedItem(item);
    setIsCompleteDialogOpen(true);
  };

  const getCakeForItem = (item: WorkItem): CustomCake | undefined => {
    if (item.itemType !== 'custom_cake') return undefined;
    return item.order.customCakes.find(c => c.id === item.itemId);
  };

  const renderDetail = (item: WorkItem) => {
    const cake = getCakeForItem(item);
    if (!cake?.design) return null;
    return <p className=" mt-0.5">🎨 {cake.design.substring(0, 100)}{cake.design.length > 100 ? '...' : ''}</p>;
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header - Mobile first */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Decoración
              </h1>
              <p className="text-sm sm:text-base  mt-1">
                Diseño y decoración de tortas
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {isConnected
                ? <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 hidden sm:inline">En vivo</span></>
                : <><WifiOff className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground hidden sm:inline">Desconectado</span></>
              }
            </div>
          </div>
        </div>

        {/* Stats - Mobile: 2 columnas, Tablet/Desktop: 3 columnas */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 px-4 sm:px-0">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 text-purple-800 rounded-lg">
                <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{decorationItems.length}</p>
                <p className="text-xs sm:text-sm  truncate">Pendientes de decorar</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 text-red-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{getUrgentItems().length}</p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;6h)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Items List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Productos para Decorar</CardTitle>
          </CardHeader>
          {!isLoading ? (
            <CardContent className="px-4 pb-4 sm:px-6">
              {decorationItems.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay productos pendientes de decorar
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {decorationItems.map(item => (
                    <WorkItemCard
                      key={`${item.itemType}-${item.itemId}`}
                      item={item}
                      urgentHours={6}
                      soonHours={12}
                      detail={renderDetail(item)}
                      onComplete={handleCompleteItem}
                      onClick={handleViewItem}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          ):(
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </Card>

        {/* Detail Dialog - Mobile optimized */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Detalles del Pedido #{selectedItem?.order.orderNumber}</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 px-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-foreground">Cliente</p>
                    <p className="font-semibold text-base text-foreground">{selectedItem.order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground">Fecha de entrega</p>
                    <p className="font-semibold text-base text-foreground">
                      {format(new Date(selectedItem.order.pickupDate), 'dd MMMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground">Hora</p>
                    <p className="font-semibold text-base text-foreground">{selectedItem.order.pickupTime}</p>
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-base text-foreground">{selectedItem.title}</h4>
                  {(() => {
                    const cake = getCakeForItem(selectedItem);
                    if (!cake) return null;
                    return (
                      <>
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
                            <div className="flex gap-2 flex-wrap">
                              {cake.referenceImages.map((img, idx) => (
                                <img key={idx} src={img} alt={`Referencia ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {selectedItem.notes && (
                    <p className="text-sm text-foreground">Notas: "{selectedItem.notes}"</p>
                  )}
                </div>

                {selectedItem.order.notes && (
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-1">
                    <p className="text-sm font-semibold text-foreground">📝 Notas del pedido:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedItem.order.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Complete Dialog - Mobile optimized */}
        <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Completar Decoración</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedItem.order.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedItem.order.customerName}</p>
                  <p className="text-sm mt-2">{selectedItem.title}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Notas de decoración (opcional)</Label>
                  <Textarea
                    placeholder="Observaciones adicionales..."
                    className="text-sm min-h-[80px] sm:min-h-[100px]"
                    value={decorationNotes}
                    onChange={(e) => setDecorationNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCompleteDialogOpen(false);
                      setDecorationNotes('');
                    }}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={completeItem}
                    className="w-full sm:w-auto order-1 sm:order-2"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Listo
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

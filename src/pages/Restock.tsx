import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { PackagePlus, Clock, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IRestockApi, defaultRestockApi } from '@/api/RestockApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import type { Order } from '@/types';

interface RestockProps {
  restockApi?: IRestockApi;
}

// Una tarea de reposición siempre trae exactamente una línea (order_items),
// creada automáticamente cuando el stock de un producto llegó a su mínimo.
const getRestockLine = (order: Order) => order.items[0];

export default function Restock({ restockApi = defaultRestockApi }: RestockProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState<number | undefined>(undefined);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Socket en tiempo real — filtra pedidos 'ready' de tipo 'restock'
  const { orders: restockOrders, isConnected } = useOrdersSocket({
    statusFilter: ['ready'],
    orderTypeFilter: 'restock',
    initialOrders,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const orders = await restockApi.getRestockOrders();
      setInitialOrders(orders);
    } catch (error) {
      console.error('Error loading restock orders:', error);
      toast.error('Error al cargar las reposiciones');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenConfirm = (order: Order) => {
    setSelectedOrder(order);
    setActualQuantity(getRestockLine(order)?.quantity);
    setIsConfirmDialogOpen(true);
  };

  const confirmRestock = async () => {
    if (!selectedOrder) return;
    const line = getRestockLine(selectedOrder);
    if (!line?.id || !actualQuantity || actualQuantity <= 0) {
      toast.error('Ingresa la cantidad realmente producida');
      return;
    }

    try {
      await restockApi.confirmRestock(selectedOrder.id, line.id, actualQuantity);
      toast.success('Reposición confirmada, stock actualizado');
      setIsConfirmDialogOpen(false);
      setSelectedOrder(null);
      setActualQuantity(undefined);
    } catch (error) {
      toast.error('Error al confirmar la reposición');
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Reposición
              </h1>
              <p className="text-sm sm:text-base  mt-1">
                Confirma la producción de reposiciones automáticas de stock
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 px-4 sm:px-0 max-w-md">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 text-purple-800 rounded-lg">
                <PackagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{restockOrders.length}</p>
                <p className="text-xs sm:text-sm  truncate">Listas para confirmar</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Reposiciones listas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6">
            {restockOrders.length === 0 ? (
              <p className="text-center  py-8 text-sm">
                No hay reposiciones pendientes de confirmar
              </p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {restockOrders.map(order => {
                  const line = getRestockLine(order);
                  if (!line) return null;

                  return isMobile ? (
                    <MobileCard key={order.id} className="overflow-hidden">
                      <div className="flex">
                        <div className="w-1.5 min-h-full bg-purple-500" />
                        <div className="flex-1 p-3">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-bold text-primary text-sm">#{order.orderNumber}</span>
                          </div>
                          <div className="text-sm bg-muted/50 p-2 rounded">
                            <p className="font-medium">
                              {line.quantity} {line.productName || line.product?.name || 'Producto'}
                            </p>
                            <p className=" mt-0.5">Cantidad planeada</p>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t">
                            <div className="flex items-center gap-1 ">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-xs">
                                {format(order.createdAt, 'dd MMM HH:mm', { locale: es })}
                              </span>
                            </div>
                            <Button size="sm" className="h-8 text-xs" onClick={() => handleOpenConfirm(order)}>
                              Confirmar
                              <CheckCircle className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </MobileCard>
                  ) : (
                    <div
                      key={order.id}
                      className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="w-2 h-full min-h-16 rounded-full bg-purple-500" />
                      <div className="flex-1">
                        <span className="font-medium">#{order.orderNumber}</span>
                        <p className="text-sm mt-1">
                          <strong>{line.quantity} {line.productName || line.product?.name || 'Producto'}</strong> — cantidad planeada
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-2 justify-end">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">{format(order.createdAt, 'dd MMM HH:mm', { locale: es })}</span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleOpenConfirm(order)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Confirmar Reposición</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedOrder.orderNumber}</p>
                  <p className="text-sm mt-1">
                    Planeado: {getRestockLine(selectedOrder)?.quantity} {getRestockLine(selectedOrder)?.productName || getRestockLine(selectedOrder)?.product?.name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Cantidad realmente producida *</Label>
                  <NumberInput
                    value={actualQuantity}
                    onChange={setActualQuantity}
                    fallback={getRestockLine(selectedOrder)?.quantity || 1}
                    min="1"
                  />
                  <p className="text-xs ">
                    Esta cantidad es la que se sumará al stock del producto — puede diferir de lo planeado.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsConfirmDialogOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={confirmRestock} className="w-full sm:w-auto order-1 sm:order-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar y Actualizar Stock
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

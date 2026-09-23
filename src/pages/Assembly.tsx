import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Hammer, AlertTriangle, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { IAssemblyApi, defaultAssemblyApi } from '@/api/AssemblyApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import { getWorkItemsAtStage } from '@/utils/workItems';
import { WorkItemCard } from '@/components/Production/WorkItemCard';
import type { Order, WorkItem } from '@/types';

interface AssemblyProps {
  assemblyApi?: IAssemblyApi;
}

export default function Assembly({ assemblyApi = defaultAssemblyApi }: AssemblyProps) {
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Socket en tiempo real — filtra pedidos con al menos una línea en 'assembling'
  const { orders, isConnected } = useOrdersSocket({
    itemStageFilter: 'assembling',
    initialOrders,
  });

  const assemblyItems = getWorkItemsAtStage(orders, 'assembling');

  const stats = {
    pendingItems: assemblyItems.length,
    urgentItems: assemblyItems.filter(i => differenceInHours(i.order.pickupDate, new Date()) < 12).length,
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const orders = await assemblyApi.getAssemblyOrders();
      setInitialOrders(orders);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCompleteDialog = (item: WorkItem) => {
    setSelectedItem(item);
    setIsCompleteDialogOpen(true);
  };

  const completeItem = async () => {
    if (!selectedItem) return;

    try {
      await assemblyApi.completeItem(selectedItem.order.id, selectedItem.itemType, selectedItem.itemId);
      // El socket actualizará la lista automáticamente via order:item_stage_changed
      toast.success('Armado completado, enviado a decoración');
      setIsCompleteDialogOpen(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error('Error al completar el armado');
    }
  };

  const renderDetail = (item: WorkItem) => {
    if (item.itemType !== 'custom_cake') return null;
    const cake = item.order.customCakes.find(c => c.id === item.itemId);
    if (!cake) return null;
    return (
      <p className=" mt-0.5">
        Relleno: {cake.fillingFlavor} {cake.secondFillingFlavor ? `/ ${cake.secondFillingFlavor}` : ''}
      </p>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Armado
              </h1>
              <p className="text-sm sm:text-base  mt-1">
                Ensamblaje de tortas
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 px-4 sm:px-0">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 text-blue-800 rounded-lg">
                <Hammer className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{stats.pendingItems}</p>
                <p className="text-xs sm:text-sm  truncate">Pendientes de armar</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 text-red-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{stats.urgentItems}</p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;12h)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Items List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Productos para Armar</CardTitle>
          </CardHeader>
          {!isLoading ? (
            <CardContent className="px-4 pb-4 sm:px-6">
              {assemblyItems.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay productos pendientes de armar
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {assemblyItems.map(item => (
                    <WorkItemCard
                      key={`${item.itemType}-${item.itemId}`}
                      item={item}
                      urgentHours={12}
                      soonHours={24}
                      detail={renderDetail(item)}
                      onComplete={handleOpenCompleteDialog}
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

        {/* Complete Assembly Dialog */}
        <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Completar Armado</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedItem.order.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedItem.order.customerName}</p>
                  <p className="text-sm mt-2">{selectedItem.title}</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCompleteDialogOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={completeItem} className="w-full sm:w-auto order-1 sm:order-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enviar a Decoración
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

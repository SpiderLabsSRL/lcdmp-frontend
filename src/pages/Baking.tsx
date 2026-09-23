import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChefHat, AlertTriangle, CheckCircle, Flame, Loader2, Wifi, WifiOff } from 'lucide-react';
import { differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { IBakingApi, defaultBakingApi } from '@/api/BakingApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import { getWorkItemsAtStage } from '@/utils/workItems';
import { WorkItemCard } from '@/components/Production/WorkItemCard';
import type { Order, BakedProduct, WorkItem } from '@/types';

interface BakingProps {
  bakingApi?: IBakingApi;
}

export default function Baking({ bakingApi = defaultBakingApi }: BakingProps) {
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [bakedProducts, setBakedProducts] = useState<BakedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Socket en tiempo real — filtra pedidos con al menos una línea en 'baking'
  const { orders, isConnected } = useOrdersSocket({
    itemStageFilter: 'baking',
    initialOrders,
  });

  const bakingItems = getWorkItemsAtStage(orders, 'baking');

  const stats = {
    pendingItems: bakingItems.length,
    totalPortions: bakingItems.reduce((sum, item) => sum + (item.itemType === 'custom_cake' ? item.quantity : 0), 0),
    urgentItems: bakingItems.filter(i => differenceInHours(i.order.pickupDate, new Date()) < 12).length,
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orders, stock] = await Promise.all([
        bakingApi.getBakingOrders(),
        bakingApi.getBakedProductsStock(),
      ]);
      setInitialOrders(orders);
      setBakedProducts(stock);
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
      await bakingApi.completeItem(selectedItem.order.id, selectedItem.itemType, selectedItem.itemId);
      // El socket actualizará la lista automáticamente via order:item_stage_changed
      toast.success('Horneado completado, enviado a armado');
      setIsCompleteDialogOpen(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error('Error al completar el horneado');
    }
  };

  const isLowStock = (product: BakedProduct): boolean => {
    return product.quantity <= product.minStock;
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Hornos
              </h1>
              <p className="text-sm sm:text-base  mt-1">
                Gestión de productos a hornear
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 px-4 sm:px-0">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 text-orange-800 rounded-lg">
                <ChefHat className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{stats.pendingItems}</p>
                <p className="text-xs sm:text-sm  truncate">Líneas pendientes</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary/10 text-primary rounded-lg">
                <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{stats.totalPortions}</p>
                <p className="text-xs sm:text-sm  truncate">Porciones a hornear</p>
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

        {/* Baked Products Stock */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Stock de Bases Horneadas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {bakedProducts.map(product => {
                const lowStock = isLowStock(product);
                return (
                  <div
                    key={product.id}
                    className={`p-2 sm:p-3 rounded-lg ${
                      lowStock ? 'bg-red-50 border border-red-200' : 'bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-base sm:text-lg font-bold ${lowStock ? 'text-red-600' : ''}`}>
                        {product.quantity}
                      </span>
                      <span className="text-xs ">/ mín {product.minStock}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Work Items List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Productos para Hornear</CardTitle>
          </CardHeader>
          {!isLoading ? (
            <CardContent className="px-4 pb-4 sm:px-6">
              {bakingItems.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay productos pendientes de hornear
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {bakingItems.map(item => (
                    <WorkItemCard
                      key={`${item.itemType}-${item.itemId}`}
                      item={item}
                      urgentHours={12}
                      soonHours={24}
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

        {/* Complete Baking Dialog */}
        <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Completar Horneado</DialogTitle>
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
                    Confirmar Horneado
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

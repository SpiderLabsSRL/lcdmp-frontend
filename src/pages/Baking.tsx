import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { ChefHat, Clock, AlertTriangle, CheckCircle, Flame, ArrowRight, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IBakingApi, defaultBakingApi } from '@/api/BakingApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import type { Order, BakedProduct, CustomCake } from '@/types';
import { hoursUntilPickupDateTime } from '@/utils/DateUtils';

interface BakingProps {
  bakingApi?: IBakingApi;
}

export default function Baking({ bakingApi = defaultBakingApi }: BakingProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [bakedProducts, setBakedProducts] = useState<BakedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bakedQuantities, setBakedQuantities] = useState<Map<string, number>>(new Map());

  // Socket en tiempo real — filtra solo pedidos con status 'baking'
  const { orders: bakingOrders, isConnected } = useOrdersSocket({
    statusFilter: ['baking'],
    initialOrders,
  });

  const getTotalPortions = (customCakes: CustomCake[]): number => {
    return customCakes.reduce((sum, cake) => sum + (cake.portions * (cake.quantity || 1)), 0);
  }

  const stats = {
    pendingOrders: bakingOrders.length,
    totalPortions: bakingOrders.reduce((sum, order) => sum + getTotalPortions(order.customCakes), 0),
    urgentOrders: bakingOrders.filter(o => differenceInHours(o.pickupDate, new Date()) < 12).length,
    completedToday: 0,
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const orders = await bakingApi.getBakingOrders();
      setInitialOrders(orders);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyBadge = (order: Order): { label: string; color: string } => {
    const hoursUntil = hoursUntilPickupDateTime(order);
    if (hoursUntil < 12) return { label: 'Urgente', color: 'bg-red-500' };
    if (hoursUntil < 24) return { label: 'Pronto', color: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-500' };
  };

  const markAsBaking = async (order: Order) => {
    try {
      await bakingApi.updateOrderStatus(order.id, 'baking');
      // El socket actualizará la lista automáticamente
      toast.success(`Pedido #${order.id} marcado como horneando`);
    } catch (error) {
      toast.error('Error al marcar el pedido');
    }
  };

  const initializeBakedQuantities = (order: Order) => {
    const quantities = new Map<string, number>();
    order.customCakes.forEach((cake: CustomCake) => {
      quantities.set(cake.cakeFlavor, 1);
    });
    setBakedQuantities(quantities);
  };

  const handleOpenCompleteDialog = (order: Order) => {
    setSelectedOrder(order);
    initializeBakedQuantities(order);
    setIsCompleteDialogOpen(true);
  };

  const updateBakedQuantity = (flavor: string, quantity: number) => {
    setBakedQuantities(prev => {
      const newMap = new Map(prev);
      newMap.set(flavor, quantity);
      return newMap;
    });
  };

  const completeBaking = async () => {
    if (!selectedOrder) return;

    try {
      await bakingApi.completeBaking(selectedOrder.id, bakedQuantities);
      // El socket actualizará la lista automáticamente via order:status_changed
      toast.success('Horneado completado y registrado en inventario');
      setIsCompleteDialogOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Error al completar el horneado');
    }
  };

  const getTotalPortionsForOrder = (order: Order): number => {
    return order.customCakes.reduce(
      (sum, cake) => sum + (cake.portions * (cake.quantity || 1)),
      0
    );
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
                <p className="text-lg sm:text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-xs sm:text-sm  truncate">Pedidos pendientes</p>
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
                <p className="text-lg sm:text-2xl font-bold">{stats.urgentOrders}</p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;12h)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 text-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-xs sm:text-sm  truncate">Completados hoy</p>
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

        {/* Orders List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pedidos para Hornear</CardTitle>
          </CardHeader>
          {!isLoading ? (
            
            <CardContent className="px-4 pb-4 sm:px-6">
              {bakingOrders.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay pedidos pendientes de hornear
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {bakingOrders.map(order => {
                    const urgency = getUrgencyBadge(order);
                    const hoursUntil = hoursUntilPickupDateTime(order);
                    const totalPortions = getTotalPortionsForOrder(order);
                    
                    return isMobile ? (
                      // Mobile Card Layout
                      <MobileCard 
                        key={order.id} 
                        className={`overflow-hidden ${
                          order.status === 'baking' ? 'border-primary' : ''
                        }`}
                      >
                        <div className="flex">
                          <div className={`w-1.5 min-h-full ${urgency.color}`} />
                          
                          <div className="flex-1 p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-primary text-sm">#{order.orderNumber}</span>
                                </div>
                                <p className="text-sm  mt-1">{order.customerName}</p>
                              </div>
                              <Badge className={`${urgency.color} text-white text-xs`}>
                                {urgency.label}
                              </Badge>
                            </div>

                            <div className="space-y-2 mt-2">
                              {order.customCakes.map((cake, i) => (
                                <div key={i} className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">{cake.portions} porciones - {cake.cakeFlavor}{cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ""}</p>
                                  {cake.shape && <p className=" mt-0.5">{cake.shape}</p>}
                                </div>
                              ))}
                              {order.items.map((cake, i) => (
                                <div key={i} className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">{cake.productName} - {cake.quantity} {cake.quantity == 1 ? "unidad" : "unidades"}</p>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t">
                              <div className="flex items-center gap-1 ">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs">
                                  {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                                </span>
                                <span className="text-xs ml-1">
                                  {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                                </span>
                              </div>
                              {order.status === 'pending' && (
                                <Button size="sm" className="h-8 text-xs" onClick={() => markAsBaking(order)}>
                                  Iniciar
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              {order.status === 'baking' && (
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  className="h-8 text-xs"
                                  onClick={() => handleOpenCompleteDialog(order)}
                                >
                                  Completar
                                  <CheckCircle className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </MobileCard>
                    ) : (
                      // Desktop Layout
                      <div 
                        key={order.id} 
                        className={`flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors`}
                      >
                        <div className={`w-2 h-full min-h-16 rounded-full ${urgency.color}`} />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium">#{order.orderNumber}</span>
                            <Badge className={urgency.color}>{urgency.label}</Badge>
                          </div>
                          <p className="text-sm ">{order.customerName}</p>
                          <div className="mt-2 space-y-1">
                            {order.customCakes.map((cake, i) => (
                              <p key={i} className="text-sm">
                                <strong>{cake.portions} porciones</strong> - {cake.cakeFlavor}{cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ""}
                                {cake.shape && ` (${cake.shape})`}
                              </p>
                            ))}
                            {order.items.map((item, i) => (
                              <p key={i} className="text-sm">
                                <strong>{item.productName} </strong> - {item.quantity} Unidades
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1  mb-2 justify-end">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">
                              {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                            </span>
                          </div>
                          <p className="text-sm font-medium whitespace-nowrap">
                            {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          {order.status === 'pending' && (
                            <Button size="sm" onClick={() => markAsBaking(order)}>
                              Iniciar
                            </Button>
                          )}
                          {order.status === 'baking' && (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => handleOpenCompleteDialog(order)}
                            >
                              Completar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedOrder.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedOrder.customerName}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm">Cantidades horneadas</Label>
                  {selectedOrder.customCakes.map((cake, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <span className="text-xs sm:text-sm">
                        {cake.cakeFlavor} ({cake.portions} porciones)
                      </span>
                      <Input 
                        type="number" 
                        value={bakedQuantities.get(cake.cakeFlavor) || 1}
                        onChange={(e) => updateBakedQuantity(cake.cakeFlavor, parseInt(e.target.value) || 0)}
                        className="w-full sm:w-20" 
                        min="0"
                        max={cake.quantity || 10}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCompleteDialogOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={completeBaking} className="w-full sm:w-auto order-1 sm:order-2">
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
import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { Hammer, Clock, AlertTriangle, CheckCircle, Package, ArrowRight, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IAssemblyApi, defaultAssemblyApi } from '@/api/AssemblyApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import type { Order, BakedProduct, CustomCake } from '@/types';
import { hoursUntilPickupDateTime } from '@/utils/DateUtils';

interface AssemblyProps {
  assemblyApi?: IAssemblyApi;
}

interface MaterialAvailability {
  [orderId: string]: boolean;
}

export default function Assembly({ assemblyApi = defaultAssemblyApi }: AssemblyProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [availableBases, setAvailableBases] = useState<BakedProduct[]>([]);
  const [materialAvailability, setMaterialAvailability] = useState<MaterialAvailability>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assembledCakes, setAssembledCakes] = useState<Map<string, boolean>>(new Map());

  // Socket en tiempo real — filtra solo pedidos con status 'assembling'
  const { orders: assemblyOrders, isConnected } = useOrdersSocket({
    statusFilter: ['assembling'],
    initialOrders,
  });

  const stats = {
    pendingOrders: assemblyOrders.length,
    urgentOrders: assemblyOrders.filter(o => differenceInHours(o.pickupDate, new Date()) < 12).length,
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

  const getUrgencyBadge = (order: Order): { label: string; color: string } => {
    const hoursUntil = hoursUntilPickupDateTime(order);
    if (hoursUntil < 12) return { label: 'Urgente', color: 'bg-red-500' };
    if (hoursUntil < 24) return { label: 'Pronto', color: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-500' };
  };

  const getTotalPortionsForOrder = (order: Order): number => {
    return order.customCakes.reduce(
      (sum, cake) => sum + (cake.portions * (cake.quantity || 1)),
      0
    );
  };

  const getTotalBasesNeeded = (order: Order): number => {
    return order.customCakes.reduce((sum, cake) => sum + (cake.quantity || 1), 0);
  };

  const initializeAssembledCakes = (order: Order) => {
    const assembled = new Map<string, boolean>();
    order.customCakes.forEach((cake, index) => {
      assembled.set(`cake-${index}`, true);
    });
    setAssembledCakes(assembled);
  };

  const handleOpenCompleteDialog = (order: Order) => {
    setSelectedOrder(order);
    initializeAssembledCakes(order);
    setIsCompleteDialogOpen(true);
  };

  const toggleCakeAssembly = (cakeId: string) => {
    setAssembledCakes(prev => {
      const newMap = new Map(prev);
      newMap.set(cakeId, !newMap.get(cakeId));
      return newMap;
    });
  };

  const completeAssembly = async () => {
    if (!selectedOrder) return;

    try {
      await assemblyApi.completeAssembly(selectedOrder.id, assembledCakes);
      // El socket actualizará la lista automáticamente via order:status_changed
      toast.success('Armado completado, pedido enviado a decoración');
      setIsCompleteDialogOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Error al completar el armado');
    }
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
                <p className="text-lg sm:text-2xl font-bold">{stats.pendingOrders}</p>
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
                <p className="text-lg sm:text-2xl font-bold">{stats.urgentOrders}</p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;12h)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Materials */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Materiales Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {availableBases.map(product => (
                <div key={product.id} className="p-2 sm:p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                  <p className="text-base sm:text-lg font-bold mt-1">{product.quantity}</p>
                  <p className="text-xs ">disponibles</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pedidos para Armar</CardTitle>
          </CardHeader>
          {!isLoading ? (

            <CardContent className="px-4 pb-4 sm:px-6">
              {assemblyOrders.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay pedidos pendientes de armar
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {assemblyOrders.map(order => {
                    const urgency = getUrgencyBadge(order);
                    const hoursUntil = hoursUntilPickupDateTime(order);
                    const totalPortions = getTotalPortionsForOrder(order);
                    const basesNeeded = getTotalBasesNeeded(order);
                    
                    return isMobile ? (
                      // Mobile Card Layout
                      <MobileCard 
                        key={order.id}
                        className={`overflow-hidden`}
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
                                  <p className=" mt-0.5">
                                    Relleno: {cake.fillingFlavor} {cake.secondFillingFlavor ? `/ ${cake.secondFillingFlavor}` : ''}
                                  </p>
                                </div>
                              ))}
                              {(order.sweetTableCombos?.length || 0) > 0 && (
                                <div className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">
                                    {order.sweetTableCombos
                                      .map(
                                        c => 
                                          `Mesa dulce ${c.products 
                                            .map(p => `${p.quantity} ${p.productName}`)
                                              .join(', ')}${c.details ? ` - ${c.details}` : ''}` )
                                      .join(', ')}
                                  </p>
                                </div>
                              )}
                              {(order.sweetTableExtras?.length || 0) > 0 && (
                                <div className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">
                                    Mesa dulce: {order.sweetTableExtras.map(e => `${e.quantity} ${e.product?.name || e.productName}`).join(', ')}
                                  </p>
                                </div>
                              )}
                              {order.items.map((item, i) => (
                                <div key={i} className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium"><strong>{item.productName} - {item.quantity} Unidades</strong></p>
                                  {item.notes && (
                                    <>
                                      <p className="font-medium">📝 Notas del producto:</p>
                                      <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                                    </>
                                  )}
                                </div>
                              ))}
                              {order.notes && (
                                <div key={order.id} className="text-xs bg-muted/50 p-2 rounded">
                                  <p className="font-medium">📝 Notas del pedido:</p>
                                  <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                                </div>
                              )}
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
                              <Button 
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleOpenCompleteDialog(order)}
                              >
                                Completar
                                <CheckCircle className="h-3 w-3 ml-1" />
                              </Button>
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
                                <br />
                                <span className="">
                                  Relleno: {cake.fillingFlavor} {cake.secondFillingFlavor ? `/ ${cake.secondFillingFlavor}` : ''}
                                </span>
                              </p>
                            ))}
                            {(order.sweetTableCombos?.length || 0) > 0 && (
                                <div>
                                  <p className="text-sm">
                                    {order.sweetTableCombos
                                      .map(
                                        c => 
                                          `Mesa dulce ${c.products 
                                            .map(p => `${p.quantity} ${p.productName}`)
                                              .join(', ')}${c.details ? ` - ${c.details}` : ''}` )
                                      .join(', ')}
                                  </p>
                                </div>
                              )}
                              {(order.sweetTableExtras?.length || 0) > 0 && (
                                <div>
                                  <p className="text-sm">
                                    Mesa dulce: {order.sweetTableExtras.map(e => `${e.quantity} ${e.product?.name || e.productName}`).join(', ')}
                                  </p>
                                </div>
                              )}
                            {order.items.map((item, i) => (
                              <div key={i}>
                                <p className="text-sm">
                                  <strong>{item.productName} - {item.quantity} Unidades</strong>
                                </p>
                                {item.notes && (
                                  <>
                                    <p className="text-sm">📝 Notas del producto:</p>
                                    <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                                  </>
                                )}
                              </div>
                            ))}
                            {order.notes && (
                              <>
                                <p className="text-sm">📝 Notas del pedido:</p>
                                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                              </>
                            )}
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

                        <Button 
                          size="sm"
                          onClick={() => handleOpenCompleteDialog(order)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Completar
                        </Button>
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

        {/* Complete Assembly Dialog */}
        <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Completar Armado</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedOrder.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedOrder.customerName}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm">Confirmar armado de:</Label>
                  {selectedOrder.customCakes.map((cake, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                      <Checkbox 
                        id={`cake-${index}`}
                        checked={assembledCakes.get(`cake-${index}`) || false}
                        onCheckedChange={() => toggleCakeAssembly(`cake-${index}`)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={`cake-${index}`} 
                          className="font-medium text-sm cursor-pointer"
                        >
                          {cake.cakeFlavor} - {cake.portions} porciones
                        </label>
                        <p className="text-xs  mt-1">
                          Relleno: {cake.fillingFlavor} {cake.secondFillingFlavor ? `/ ${cake.secondFillingFlavor}` : ''}
                        </p>
                        {cake.secondCakeFlavor && (
                          <p className="text-xs  mt-0.5">
                            Segundo sabor: {cake.secondCakeFlavor}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                      <Checkbox 
                        id={`item-${index}`}
                        checked={assembledCakes.get(`item-${index}`) || false}
                        onCheckedChange={() => toggleCakeAssembly(`item-${index}`)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={`cake-${index}`} 
                          className="font-medium text-sm cursor-pointer"
                        >
                          {item.productName} - {item.quantity} unidades
                        </label>
                      </div>
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
                  <Button onClick={completeAssembly} className="w-full sm:w-auto order-1 sm:order-2">
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
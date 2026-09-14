import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { Palette, Clock, AlertTriangle, CheckCircle, Image, Eye, ArrowRight, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IDecorationApi, defaultDecorationApi } from '@/api/DecorationApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import type { Order, CustomCake, OrderItem } from '@/types';

interface DecorationProps {
  decorationApi?: IDecorationApi;
}

export default function Decoration({ decorationApi = defaultDecorationApi }: DecorationProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [decorationNotes, setDecorationNotes] = useState('');
  const [completedCakes, setCompletedCakes] = useState<Set<string>>(new Set());

  // Socket en tiempo real — filtra solo pedidos con status 'decorating'
  const { orders: decorationOrders, isConnected } = useOrdersSocket({
    statusFilter: ['decorating'],
    initialOrders,
  });

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

  // Calcular estadísticas
  const getUrgentOrders = () => {
    return decorationOrders.filter(o => differenceInHours(new Date(o.pickupDate), new Date()) < 6);
  };

  const getCompletedOrdersCount = () => {
    // Este dato debería venir del API, por ahora usamos el estado local
    return decorationOrders.filter(o => o.status === 'ready').length;
  };

  const getUrgencyBadge = (order: Order) => {
    const hoursUntil = differenceInHours(new Date(order.pickupDate), new Date());
    if (hoursUntil < 6) return { label: 'Urgente', color: 'bg-red-500' };
    if (hoursUntil < 12) return { label: 'Pronto', color: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-500' };
  };

  const loadOrderDetails = async (orderId: string) => {
    try {
      const order = await decorationApi.getOrderDetails(orderId);
      setSelectedOrder(order);
    } catch (error) {
      console.error('Error loading order details:', error);
      toast.error('Error al cargar los detalles del pedido');
    }
  };

  const completeDecoration = async () => {
    if (!selectedOrder) return;

    try {
      await decorationApi.completeDecoration(selectedOrder.id, decorationNotes);
      
      toast.success('Decoración completada, pedido listo para entrega');
      
      // Resetear estado — el socket removerá el pedido de la lista automáticamente
      setIsCompleteDialogOpen(false);
      setSelectedOrder(null);
      setDecorationNotes('');
      setCompletedCakes(new Set());
    } catch (error) {
      console.error('Error completing decoration:', error);
      toast.error('Error al completar la decoración');
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailDialogOpen(true);
  };

  const handleCompleteOrder = (order: Order) => {
    setSelectedOrder(order);
    setCompletedCakes(new Set(order.customCakes?.map((_, idx) => `cake-${idx}`) || []));
    setIsCompleteDialogOpen(true);
  };

  const getCakeDescription = (cake: CustomCake) => {
    let description = `${cake.portions} porciones - ${cake.cakeFlavor}${cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ''}`;
    if (cake.shape) description += ` (${cake.shape})`;
    return description;
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
                <p className="text-lg sm:text-2xl font-bold">{decorationOrders.length}</p>
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
                <p className="text-lg sm:text-2xl font-bold">{getUrgentOrders().length}</p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;6h)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 text-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{getCompletedOrdersCount()}</p>
                <p className="text-xs sm:text-sm  truncate">Completados hoy</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pedidos para Decorar</CardTitle>
          </CardHeader>
          {!isLoading ? (

            <CardContent className="px-4 pb-4 sm:px-6">
              {decorationOrders.length === 0 ? (
                <p className="text-center  py-8 text-sm">
                  No hay pedidos pendientes de decorar
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {decorationOrders.map(order => {
                    const urgency = getUrgencyBadge(order);
                    const hoursUntil = differenceInHours(new Date(order.pickupDate), new Date());
                    
                    return isMobile ? (
                      // Mobile Card Layout
                      <MobileCard 
                        key={order.id} 
                        className="overflow-hidden"
                        onClick={() => handleViewOrder(order)}
                      >
                        <div className="flex">
                          {/* Urgency color bar - vertical a la izquierda */}
                          <div className={`w-1.5 min-h-full ${urgency.color}`} />
                          
                          <div className="flex-1 p-3">
                            {/* Header con badges */}
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-primary text-sm">#{order.orderNumber}</span>
                                </div>
                                <p className="text-sm  mt-1">{order.customerName}</p>
                              </div>
                            </div>

                            <div className="space-y-2 mt-2">
                              {order.customCakes?.map((cake, i) => (
                                <div key={i} className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">{getCakeDescription(cake)}</p>
                                  {cake.design && 
                                    <p className=" mt-0.5">🎨 {cake.design.substring(0, 50)}</p>
                                  }
                                </div>
                              ))}
                              {order.items?.map((item, i) => (
                                <div key={i} className="text-sm bg-muted/50 p-2 rounded">
                                  <p className="font-medium">
                                    <strong>{item.productName} - {item.quantity} Unidades</strong>
                                  </p>
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

                            {/* Footer con tiempo y botones */}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t">
                              <div className="flex items-center gap-1 ">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs">
                                  {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                                </span>
                                <span className="text-xs ml-1">
                                  {format(new Date(order.pickupDate), 'dd MMM', { locale: es })} {order.pickupTime}
                                </span>
                              </div>
                              <Button 
                                size="sm"
                                className="h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompleteOrder(order);
                                }}
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
                        className="flex items-center gap-4 p-4 rounded-lg transition-colors bg-muted/50 hover:bg-muted"
                      >
                        <div className={`w-2 h-full min-h-16 rounded-full ${urgency.color}`} />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium">#{order.orderNumber}</span>
                            <Badge className={urgency.color}>{urgency.label}</Badge>
                          </div>
                          
                          <p className="text-sm  mb-3">{order.customerName}</p>
                          
                          <div className="space-y-2">
                            {order.customCakes?.map((cake, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-sm">
                                  <strong>{cake.portions} porciones</strong> - {cake.cakeFlavor}{cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ''}
                                  {cake.shape && <span className=""> ({cake.shape})</span>}  
                                  <br />
                                  {cake.design && (
                                    <span className="">
                                      🎨 {cake.design.substring(0, 100)} {cake.design.length > 100 ? '...' : ''}
                                    </span>
                                  )}
                                </p>
                              </div>
                            ))}
                            {order.items?.map((item, i) => (
                              <div key={i} className="space-y-1">
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
                          <div className="flex items-center gap-1  justify-end">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                            </span>
                          </div>
                          <p className="text-sm whitespace-nowrap">
                            {format(new Date(order.pickupDate), 'dd MMM', { locale: es })} {order.pickupTime}
                          </p>
                        </div>

                        <Button 
                          size="sm"
                          onClick={() => handleCompleteOrder(order)}
                          className="whitespace-nowrap"
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

        {/* Detail Dialog - Mobile optimized */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Detalles del Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-xs sm:text-sm ">Cliente</p>
                    <p className="font-medium text-sm">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm ">Teléfono</p>
                    <p className="font-medium text-sm">{selectedOrder.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm ">Fecha de entrega</p>
                    <p className="font-medium text-sm">
                      {format(new Date(selectedOrder.pickupDate), 'dd MMMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm ">Hora</p>
                    <p className="font-medium text-sm">{selectedOrder.pickupTime}</p>
                  </div>
                </div>

                {selectedOrder.customCakes?.map((cake, i) => (
                  <div key={i} className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm sm:text-base">
                      {cake.cakeFlavor}{cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ""} - {cake.portions} porciones
                    </h4>
                    {cake.shape && <p className="text-xs sm:text-sm">Forma: {cake.shape}</p>}
                    <p className="text-xs sm:text-sm">Relleno: {cake.fillingFlavor} {cake.secondFillingFlavor ? `/ ${cake.secondFillingFlavor}` : ''}</p>
                    {cake.design && (
                      <div className="p-2 sm:p-3 bg-background rounded border">
                        <p className="text-xs sm:text-sm font-medium">Diseño requerido:</p>
                        <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap">{cake.design}</p>
                      </div>
                    )}
                    {cake.dedication && (
                      <p className="text-xs sm:text-sm">Dedicatoria: "{cake.dedication}"</p>
                    )}
                    {cake.referenceImages && cake.referenceImages.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">Imágenes de referencia:</p>
                        <div className="flex gap-2 flex-wrap">
                          {cake.referenceImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Referencia ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm sm:text-base">
                      {item.productName} - {item.quantity} Unidades
                    </h4>
                    {item.notes && (
                      <p className="text-xs sm:text-sm">Notas: "{item.notes}"</p>
                    )}
                  </div>
                ))}
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
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedOrder.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedOrder.customerName}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm">Confirmar decoración de:</Label>
                  {selectedOrder.customCakes?.map((cake, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                      <Checkbox 
                        id={`cake-dec-${i}`} 
                        checked={completedCakes.has(`cake-${i}`)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(completedCakes);
                          if (checked) {
                            newSet.add(`cake-${i}`);
                          } else {
                            newSet.delete(`cake-${i}`);
                          }
                          setCompletedCakes(newSet);
                        }}
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={`cake-dec-${i}`} 
                          className="font-medium text-sm cursor-pointer"
                        >
                          {cake.cakeFlavor}{cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ''} - {cake.portions} porciones
                        </label>
                        {cake.design && (
                          <p className="text-xs  mt-1 line-clamp-2">{cake.design}</p>
                        )}
                        {cake.dedication && (
                          <p className="text-xs  mt-1 line-clamp-2">{cake.dedication}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                      <Checkbox 
                        id={`item-dec-${i}`} 
                        checked={completedCakes.has(`item-${i}`)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(completedCakes);
                          if (checked) {
                            newSet.add(`item-${i}`);
                          } else {
                            newSet.delete(`item-${i}`);
                          }
                          setCompletedCakes(newSet);
                        }}
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={`cake-dec-${i}`} 
                          className="font-medium text-sm cursor-pointer"
                        >
                          {item.productName} - {item.quantity} Unidades
                        </label>
                        {item.notes && (
                          <p className="text-xs  mt-1 line-clamp-2">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
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
                      setCompletedCakes(new Set());
                    }}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={completeDecoration} 
                    className="w-full sm:w-auto order-1 sm:order-2"
                    disabled={completedCakes.size === 0}
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

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MobileCard, useIsMobile } from '@/components/ui/responsive-table';
import { Truck, Clock, MapPin, Phone, CheckCircle, Package, Navigation, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { IDeliveryApi, defaultDeliveryApi } from '@/api/DeliveryApi';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import type { Order } from '@/types';
import { hoursUntilPickupDateTime } from '@/utils/DateUtils';

interface DeliveryProps {
  deliveryApi?: IDeliveryApi;
}

export default function Delivery({ deliveryApi = defaultDeliveryApi }: DeliveryProps) {
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Socket en tiempo real — filtra solo pedidos con status 'ready'
  const { orders: allReadyOrders, isConnected } = useOrdersSocket({
    statusFilter: ['ready'],
    initialOrders,
  });

  // Separar entre entregas a domicilio y recogidas en tienda
  const deliveryOrders = allReadyOrders
    .filter(o => o.deliveryAddress)
    .sort((a, b) => differenceInHours(a.pickupDate, new Date()) - differenceInHours(b.pickupDate, new Date()));

  const pickupOrders = allReadyOrders
    .filter(o => !o.deliveryAddress)
    .sort((a, b) => differenceInHours(a.pickupDate, new Date()) - differenceInHours(b.pickupDate, new Date()));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const orders = await deliveryApi.getDeliveryOrders();
      setInitialOrders(orders);
    } catch (error) {
      console.error('Error loading delivery orders:', error);
      toast.error('Error al cargar los pedidos de entrega');
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyBadge = (order: Order) => {
    const hoursUntil = hoursUntilPickupDateTime(order);
    if (hoursUntil < 2) return { label: 'Urgente', color: 'bg-red-500' };
    if (hoursUntil < 6) return { label: 'Pronto', color: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-500' };
  };

  const completeDelivery = async () => {
    if (!selectedOrder) return;
    try {
      await deliveryApi.completeDelivery(selectedOrder.id);
      // El socket actualizará la lista automáticamente via order:status_changed
      toast.success('Entrega completada exitosamente');
      setIsCompleteDialogOpen(false);
      setSelectedOrder(null);
      setDeliveryNotes('');
    } catch (error) {
      toast.error('Error al completar la entrega');
    }
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
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
        {/* Header - Mobile first */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Delivery
              </h1>
              <p className="text-sm sm:text-base  mt-1">
                Gestión de entregas y recogidas
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

        {/* Stats - Mobile: 2 columnas, Tablet/Desktop: 4 columnas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 px-4 sm:px-0">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 text-blue-800 rounded-lg">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{deliveryOrders.length}</p>
                <p className="text-xs sm:text-sm  truncate">Para entregar</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 text-purple-800 rounded-lg">
                <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{pickupOrders.length}</p>
                <p className="text-xs sm:text-sm  truncate">Para recoger</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 text-red-800 rounded-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">
                  {allReadyOrders.filter(o => differenceInHours(o.pickupDate, new Date()) < 2).length}
                </p>
                <p className="text-xs sm:text-sm  truncate">Urgentes (&lt;2h)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 text-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">0</p>
                <p className="text-xs sm:text-sm  truncate">Entregados hoy</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deliveries */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
              Entregas a Domicilio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6">
            {deliveryOrders.length === 0 ? (
              <p className="text-center  py-8 text-sm">
                No hay entregas pendientes
              </p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {deliveryOrders.map(order => {
                  const urgency = getUrgencyBadge(order);
                  const hoursUntil = hoursUntilPickupDateTime(order);
                  
                  return isMobile ? (
                    // Mobile Card Layout for Deliveries
                    <MobileCard 
                      key={order.id} 
                      className="overflow-hidden"
                    >
                      <div className="flex">
                        <div className={`w-1.5 min-h-full ${urgency.color}`} />
                        
                        <div className="flex-1 p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-sm">#{order.orderNumber}</h3>
                              </div>
                              <p className="text-xs  mt-1">{order.customerName}</p>
                            </div>
                            <Badge className={`${urgency.color} text-white text-xs`}>
                              {urgency.label}
                            </Badge>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div  className="text-xs bg-muted/50 p-2 rounded">
                              <div className="flex items-start gap-2 text-xs ">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{order.deliveryAddress}</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs">
                                <a href={`tel:${order.customerPhone}`} className="text-primary flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                  {order.customerPhone}
                                </a>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <p className="text-xs ">
                                Saldo: Bs. {order.total - order.deposit}
                              </p>
                              <p className="text-xs ">
                                Costo de envío: Bs. {order.deliveryCost}
                              </p>
                            </div>
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
                              onClick={() => { setSelectedOrder(order); setIsCompleteDialogOpen(true); }}
                            >
                              Entregado
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
                          <h3 className="font-medium">#{order.orderNumber}</h3>
                          <Badge className={urgency.color}>{urgency.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="font-medium">{order.customerName}</span>
                          <span className="">•</span>
                          <a href={`tel:${order.customerPhone}`} className="text-primary flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </a>
                        </div>
                        <div className="mt-2 space-y-1">
                          {order.customCakes.map((cake, i) => (
                            <p key={i} className="text-sm">
                              <strong>{cake.portions} porciones</strong>
                              <br />
                            </p>
                          ))}
                          <div className='flex items-start gap-1 mt-2 text-sm '>
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="break-words">{order.deliveryAddress}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap">
                        <div className="flex items-center gap-1  mb-1 justify-end">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                          </span>
                        </div>
                        <p className="text-sm">
                          {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                        </p>
                        <p className="text-xs ">
                          Saldo: Bs. {order.total - order.deposit}
                        </p>
                        <p className="text-xs ">
                          Costo de envío: Bs. {order.deliveryCost}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openMaps(order.deliveryAddress!)}
                        >
                          <Navigation className="h-4 w-4 mr-1" />
                          Mapa
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setIsCompleteDialogOpen(true); }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Entregado
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pickups */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader className="px-4 py-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              Recogidas en Tienda
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6">
            {pickupOrders.length === 0 ? (
              <p className="text-center  py-8 text-sm">
                No hay recogidas pendientes
              </p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {pickupOrders.map(order => {
                  const urgency = getUrgencyBadge(order);
                  const hoursUntil = differenceInHours(order.pickupDate, new Date());
                  
                  return isMobile ? (
                    <MobileCard key={order.id} className="overflow-hidden">
                      <div className="flex">
                        <div className={`w-1.5 min-h-full ${urgency.color}`} />
                        
                        <div className="flex-1 p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-sm">#{order.orderNumber}</h3>
                                <Badge className={`${urgency.color} text-white text-xs`}>
                                  {urgency.label}
                                </Badge>
                              </div>
                              <p className="text-xs  mt-1">{order.customerName}</p>
                            </div>
                            <div className="text-right ml-2">
                              <div className="flex items-center gap-1 ">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs">{hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}</span>
                              </div>
                              <p className="text-xs font-medium mt-1">
                                {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs">
                              <a href={`tel:${order.customerPhone}`} className="text-primary flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {order.customerPhone}
                              </a>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                              <div>
                                <p className="text-xs ">Total</p>
                                <p className="font-bold text-primary text-sm">Bs. {order.total}</p>
                              </div>
                              <p className="text-xs ">
                                Saldo: Bs. {order.total - order.deposit}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3 pt-2 border-t">
                            <Button 
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => { setSelectedOrder(order); setIsCompleteDialogOpen(true); }}
                            >
                              Entregado
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
                          <h3 className="font-medium">#{order.orderNumber}</h3>
                          <Badge className={urgency.color}>{urgency.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="font-medium">{order.customerName}</span>
                          <span className="">•</span>
                          <a href={`tel:${order.customerPhone}`} className="text-primary flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </a>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap">
                        <div className="flex items-center gap-1  mb-1 justify-end">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {hoursUntil > 0 ? `${hoursUntil}h` : 'Atrasado'}
                          </span>
                        </div>
                        <p className="text-sm">
                          {format(order.pickupDate, 'dd MMM', { locale: es })} {order.pickupTime}
                        </p>
                        <p className="font-bold text-primary mt-1">Bs. {order.total}</p>
                        <p className="text-xs ">
                          Saldo: Bs. {order.total - order.deposit}
                        </p>
                      </div>

                      <Button 
                        size="sm"
                        onClick={() => { setSelectedOrder(order); setIsCompleteDialogOpen(true); }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Entregado
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Dialog - Mobile optimized */}
        <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Confirmar Entrega</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 px-1">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">Pedido #{selectedOrder.orderNumber}</p>
                  <p className="text-xs sm:text-sm ">{selectedOrder.customerName}</p>
                  {selectedOrder.deliveryAddress && (
                    <p className="text-xs sm:text-sm mt-1 break-words">{selectedOrder.deliveryAddress}</p>
                  )}
                </div>

                <div className="p-3 sm:p-4 bg-primary/5 rounded-lg">
                  <p className="text-xs sm:text-sm ">Saldo pendiente</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">
                    Bs. {selectedOrder.total - selectedOrder.deposit}
                  </p>
                </div>

                {selectedOrder.guarantee && (
                  <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="font-medium text-orange-800 text-sm">Garantía a recuperar</p>
                    <p className="text-xs sm:text-sm text-orange-700">
                      Bs. {selectedOrder.guarantee.amount} - {selectedOrder.guarantee.items}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Notas de entrega (opcional)</Label>
                  <Textarea 
                    placeholder="Observaciones de la entrega..." 
                    className="text-sm min-h-[80px] sm:min-h-[100px]"
                    value={deliveryNotes}
                    onChange={e => setDeliveryNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCompleteDialogOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={completeDelivery} className="w-full sm:w-auto order-1 sm:order-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Entrega
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
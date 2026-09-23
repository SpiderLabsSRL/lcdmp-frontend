import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileCard, MobileCardHeader, useIsMobile } from '@/components/ui/responsive-table';
import { Plus, Search, Eye, RefreshCw, Filter, Trash2, Edit, Loader2, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateOrderData, Order, OrderStatus, UpdateOrderData,Flavor, Product, OrderFilters, SweetTableCombo } from '@/types';
import { toast } from 'sonner';
import { statusConfig } from '@/types/consts';
import { IOrdersApi, defaultOrdersApi } from '@/api/OrdersApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useOrdersSocket } from '@/hooks/useOrdersSocket';
import { OrderType, PaymentMethod } from '../types/index';
import OrderForm from '@/components/Forms/OrderForm';
import OrderDetail from '@/components/Dialogs/OrderDetail';

interface OrdersProps {
  ordersApi?: IOrdersApi;
}

export const getOrderType = (orderType: OrderType) => {
  let type;
  switch (orderType.toLowerCase()) {
    case "cake":
      type = "Torta";
      break;
    case "products":
      type = "Productos";
      break;
    case "sweet_table":
      type = "Mesa Dulce";
      break;
    case "mixed":
      type = "Varios";
      break;
    default:
      type = "";
      break
  }
  return type;
}

export default function Orders({ ordersApi = defaultOrdersApi }: OrdersProps) {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fillings, setFillings] = useState<Flavor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sweetTableCombos, setSweetTableCombos] = useState<SweetTableCombo[]>([]);
  const [stats, setStats] = useState<Array<{ status: string; label: string; color: string; icon: any; count: number }>>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const isPhoneSearch = useMemo(() => {
    return /^\d+$/.test(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const statusFilter = useMemo(() => {
    return selectedStatus !== 'all' ? [selectedStatus] : undefined;
  }, [selectedStatus]);

  const { orders, setOrders, isConnected } = useOrdersSocket({
    statusFilter,
    initialOrders,
  });

  const loadOrders = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      
      const filters: OrderFilters = {};
      
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus as OrderStatus;
      }
      
      if (debouncedSearchTerm) {
        if (isPhoneSearch) {
          filters.customerPhone = debouncedSearchTerm;
        } else {
          filters.customerName = debouncedSearchTerm;
        }
      }
      
      const [ordersData, flavors, productsResponse, combosResponse] = await Promise.all([
        ordersApi.getOrders(filters, abortControllerRef.current.signal),
        ordersApi.getFlavors(),
        ordersApi.getProducts(),
        ordersApi.getSweetTableCombos()
      ]);
      
      if (!abortControllerRef.current.signal.aborted) {
        setInitialOrders(ordersData);
        setFillings(flavors);
        setProducts(productsResponse);
        setSweetTableCombos(combosResponse);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading orders:', error);
        toast.error(error.message || 'Error al cargar los pedidos');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [selectedStatus, debouncedSearchTerm, isPhoneSearch, ordersApi]);

  useEffect(() => {
    const newStats = Object.entries(statusConfig).map(([status, config]) => ({
      status,
      ...config,
      count: orders.filter(o => o.status === status).length
    }));
    setStats(newStats);
  }, [orders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getOrderPriority = (order: Order) => {
    const hoursUntilPickup = (order.pickupDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const totalPortions = order.customCakes.reduce((sum, cake) => sum + cake.portions, 0);
    return hoursUntilPickup - (totalPortions / 10);
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => getOrderPriority(a) - getOrderPriority(b));
  }, [orders]);

  const handleCreateOrder = async (orderData: CreateOrderData) => {
    try {
      const newOrder = await ordersApi.createOrder(orderData);
      await loadOrders();
      toast.success('Pedido creado exitosamente');
      setIsNewOrderOpen(false);
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Error al crear el pedido');
    }
  };

  const handleUpdateOrder = async (id: string, data: UpdateOrderData) => {
    try {
      data.pickupTime = data.pickupTime.slice(0,5);
      const updatedOrder = await ordersApi.updateOrder(id, data);
      await loadOrders();
      toast.success('Pedido actualizado exitosamente');
      setEditingOrder(null);
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error(error.message || 'Error al actualizar el pedido');
    }
  };

  const handleUpdateStatus = async (id: string, status: OrderStatus, paymentMethod?: PaymentMethod) => {
    try {
      const updatedOrder = await ordersApi.updateOrderStatus(id, status, paymentMethod);
      await loadOrders();
      toast.success(`Estado actualizado a ${statusConfig[status].label}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Error al actualizar el estado');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido?')) return;
    
    try {
      await ordersApi.deleteOrder(id);
      await loadOrders();
      toast.success('Pedido eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting order:', error);
      toast.error(error.message || 'Error al eliminar el pedido');
    }
  };

  const handleDeliverOrder = async (orderId: string, paymentMethod: PaymentMethod) => {
    setSelectedOrder(null);
    await handleUpdateStatus(orderId, 'delivered', paymentMethod)
  };

  const handleCancelOrder = async (orderId: string) => {
    setSelectedOrder(null);
    await handleUpdateStatus(orderId, 'cancelled');
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    toast.info('Filtros restablecidos');
  };

  const handleEditOrder = async (o: Order) => {
    const order = await ordersApi.getOrderById(o.id);
    setEditingOrder(order);
  };

  const handleSelectOrder = async (o: Order) => {
    const order = await ordersApi.getOrderById(o.id);
    setSelectedOrder(order);
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Pedidos
              </h1>
              <p className="text-sm sm:text-base ">
                Gestión de pedidos de tortas y combos
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {isConnected
                ? <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 hidden sm:inline">En vivo</span></>
                : <><WifiOff className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground hidden sm:inline">Desconectado</span></>
              }
            </div>
          </div>
          
          <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Nuevo Pedido</DialogTitle>
              </DialogHeader>
              <OrderForm
                onSubmit={handleCreateOrder}
                onClose={() => setIsNewOrderOpen(false)}
                products={products}
                flavors={fillings}
                sweetTableCombos={sweetTableCombos}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 px-4 sm:px-0">
          {stats.slice(1, 5).map(({ status, label, color, icon: Icon, count }) => (
            <Card 
              key={status} 
              className={`cursor-pointer hover:shadow-md transition-shadow active:scale-95 sm:active:scale-100 ${
                selectedStatus === status ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedStatus(status === selectedStatus ? 'all' : status)}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg ${color} flex-shrink-0`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{count}</p>
                  <p className="text-xs sm:text-sm  truncate">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mx-4 sm:mx-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex sm:hidden items-center justify-between mb-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
              </Button>
            </div>

            <div className={`${showFilters ? 'block' : 'hidden'} sm:block space-y-3 sm:space-y-0`}>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " />
                  <Input 
                    placeholder="Buscar por nombre o teléfono..." 
                    className="pl-10 w-full text-sm sm:text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {Object.entries(statusConfig).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  size="icon" 
                  className="sm:w-10 h-10 shrink-0"
                  onClick={resetFilters}
                  title="Restablecer filtros"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {(searchTerm || selectedStatus !== 'all') && (
                <div className="flex items-center gap-2 text-xs  mt-2 sm:hidden">
                  <span>Filtros activos:</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Búsqueda: "{searchTerm}"
                    </Badge>
                  )}
                  {selectedStatus !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      Estado: {statusConfig[selectedStatus as OrderStatus]?.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isMobile ? (
          <div className="space-y-3 px-4">
            {sortedOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="">No se encontraron pedidos</p>
                </CardContent>
              </Card>
            ) : (
              sortedOrders.map(order => {
                const config = statusConfig[order.status];
                const Icon = config.icon;
                return (
                  <MobileCard
                    key={order.id}
                    className="active:scale-[0.98] transition-transform cursor-pointer"
                    onClick={() => handleSelectOrder(order)}
                  >
                    <MobileCardHeader className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-primary text-sm">#{order.orderNumber}</span>
                        <Badge className={`${config.color} text-xs px-2 py-0.5`}>
                          <Icon className="h-3 w-3 mr-1 inline" />
                          {config.label}
                        </Badge>
                      </div>
                      {(order.status !== 'cancelled' && order.status !== 'delivered') && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditOrder(order);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </MobileCardHeader>
                    
                    <div className="space-y-2 px-3 pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{order.customerName}</p>
                          <p className="text-xs ">{order.customerPhone}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium text-sm">{format(order.pickupDate, 'dd MMM', { locale: es })}</p>
                          <p className="text-xs ">{order.pickupTime}</p>
                        </div>
                      </div>
                      
                      <div className="text-sm bg-muted/50 p-2 rounded space-y-1">
                        {order.customCakes.length > 0 && (
                          <div className="text-sm bg-muted/50 p-2 rounded">
                            <p className="font-medium">
                              {order.customCakes.map(c => `${c.portions}p ${c.cakeFlavor}`).join(', ')}
                            </p>
                          </div>
                        )}
                        {(order.sweetTableCombos?.length || 0) > 0 && (
                          <div className="text-sm bg-muted/50 p-2 rounded">
                            <p className="font-medium">
                              {order.sweetTableCombos.map(c => `Mesa dulce (${c.totalQuantity} postres)`).join(', ')}
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
                        {order.items.length > 0 && (
                          <div className="text-sm bg-muted/50 p-2 rounded">
                            <p className="font-medium">
                              {order.items.map((item,i) => `${item.quantity} ${item.productName}`).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t text-sm">
                        <div>
                          <p className="text-xs ">Adelanto</p>
                          <p className="font-medium">Bs. {order.deposit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs ">Total</p>
                          <p className="font-bold text-primary">Bs. {order.total}</p>
                        </div>
                      </div>
                    </div>
                  </MobileCard>
                );
              })
            )}
          </div>
        ) : (
          <Card className="mx-4 sm:mx-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Pedido</TableHead>
                    <TableHead className="whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">Fecha Entrega</TableHead>
                    <TableHead className="whitespace-nowrap">Descripción</TableHead>
                    <TableHead className="whitespace-nowrap">Total</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 ">
                        No se encontraron pedidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedOrders.map(order => {
                      const config = statusConfig[order.status];
                      const Icon = config.icon;
                      return (
                        <TableRow
                          key={order.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleSelectOrder(order)}
                        >
                          <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.customerName}</p>
                              <p className="text-sm ">{order.customerPhone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{format(order.pickupDate, 'dd MMM', { locale: es })}</p>
                              <p className="text-sm ">{order.pickupTime}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {order.customCakes.length > 0 && (
                                <p className="text-sm">
                                  {order.customCakes.map(c => `${c.portions}p ${c.cakeFlavor}`).join(', ')}
                                </p>
                              )}
                              {(order.sweetTableCombos?.length || 0) > 0 && (
                                <p className="text-sm ">
                                  {order.sweetTableCombos.map(c => `Mesa dulce (${c.totalQuantity} postres)`).join(', ')}
                                </p>
                              )}
                              {(order.sweetTableExtras?.length || 0) > 0 && (
                                <p className="text-sm ">
                                  Mesa Dulce: {order.sweetTableExtras.map(e => `${e.quantity} ${e.product?.name || e.productName}`).join(', ')}
                                </p>
                              )}
                              {order.items.length > 0 && (
                                <p className="text-sm">
                                  {order.items.map((item,i) => `${item.quantity} ${item.productName}`).join(', ')}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-bold">Bs. {order.total}</p>
                            <p className="text-sm ">
                              Adelanto: Bs. {order.deposit}
                            </p>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Badge className={`${config.color} w-auto`}>
                              <Icon className="h-3 w-3 mr-1 inline" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {(order.status !== 'cancelled' && order.status !== 'delivered') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditOrder(order);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" /> Editar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            </DialogHeader>
            {selectedOrder && <OrderDetail
              order={selectedOrder}
              onDeliver={handleDeliverOrder}
              onCancel={handleCancelOrder}
              ordersApi={ordersApi}
            />}
          </DialogContent>
        </Dialog>

        {/* Edit Order Dialog */}
        <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
          <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Editar Pedido #{editingOrder?.orderNumber}</DialogTitle>
            </DialogHeader>
            {editingOrder && (
              <OrderForm
                initialData={editingOrder}
                onSubmit={(data) => handleUpdateOrder(editingOrder.id, data)}
                onClose={() => setEditingOrder(null)}
                products={products}
                flavors={fillings}
                sweetTableCombos={sweetTableCombos}
                isEditing
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

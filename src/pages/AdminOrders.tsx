import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { statusConfig } from '@/types/consts';
import { IOrdersApi, defaultOrdersApi } from '@/api/OrdersApi';
import { IMaterialsApi, defaultMaterialsApi } from '@/api/MaterialsApi';
import { IInventoryApi, defaultInventoryApi } from '@/api/InventoryApi';
import { useDebounce } from '@/hooks/useDebounce';
import { getLocalDateString, parseLocalDate } from '@/utils/DateUtils';
import { getOrderWorkItems } from '@/utils/workItems';
import OrderDetail from '@/components/Dialogs/OrderDetail';
import MaterialUsageSection from '@/components/Dialogs/MaterialUsageSection';
import { OrderHistorySection, OrderStatusControls } from '@/components/Dialogs/OrderAdminSections';
import type { Order, OrderFilters, OrderStatus, PaymentMethod, ProductStatus, WorkItem } from '@/types';

interface AdminOrdersProps {
  ordersApi?: IOrdersApi;
  materialsApi?: IMaterialsApi;
  inventoryApi?: IInventoryApi;
}

// 'from_today': de hoy en adelante (por defecto) · 'day': una fecha · 'range': desde/hasta (pasadas o futuras)
type DateMode = 'from_today' | 'day' | 'range';

export default function AdminOrders({
  ordersApi = defaultOrdersApi,
  materialsApi = defaultMaterialsApi,
  inventoryApi = defaultInventoryApi,
}: AdminOrdersProps) {
  const [dateMode, setDateMode] = useState<DateMode>('from_today');
  const [day, setDay] = useState(getLocalDateString());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);

  const rangeInvalid = dateMode === 'range' && !!from && !!to && from > to;

  const filters = useMemo<OrderFilters>(() => {
    const f: OrderFilters = { excludeOrderType: 'restock', allDates: true };
    if (dateMode === 'from_today') {
      f.startDate = parseLocalDate(getLocalDateString());
    } else if (dateMode === 'day') {
      if (day) f.startDate = f.endDate = parseLocalDate(day);
    } else {
      if (from) f.startDate = parseLocalDate(from);
      if (to) f.endDate = parseLocalDate(to);
    }
    if (status !== 'all') f.status = status as OrderStatus;
    if (debouncedSearch) {
      if (/^\d+$/.test(debouncedSearch)) f.customerPhone = debouncedSearch;
      else f.customerName = debouncedSearch;
    }
    return f;
  }, [dateMode, day, from, to, status, debouncedSearch]);

  const loadOrders = useCallback(async () => {
    if (rangeInvalid) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const data = await ordersApi.getOrders(filters);
      if (request === requestRef.current) setOrders(data);
    } catch (error: any) {
      if (request === requestRef.current) toast.error(error.message || 'Error al cargar los pedidos');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filters, ordersApi, rangeInvalid]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = async (o: Order) => {
    try {
      setSelected(await ordersApi.getOrderById(o.id));
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar el pedido');
    }
  };

  // Ejecuta un cambio, refresca el pedido abierto y la lista.
  const runChange = async (orderId: string, action: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await action();
      setSelected(await ordersApi.getOrderById(orderId));
      await loadOrders();
      toast.success(successMsg);
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error(error.message || 'Error al actualizar el pedido');
      try {
        setSelected(await ordersApi.getOrderById(orderId));
        await loadOrders();
      } catch { /* se conserva lo que ya se muestra */ }
    } finally {
      setBusy(false);
    }
  };

  const handleItemStage = (order: Order, item: WorkItem, stage: ProductStatus) => {
    if (item.status === stage) return;
    runChange(
      order.id,
      async () => { await ordersApi.advanceItemStage(order.id, item.itemType, item.itemId, stage); },
      `Producto actualizado a ${statusConfig[stage].label}`
    );
  };

  // Pedido completo: baja todas las líneas a la etapa elegida (un pedido cancelado se reactiva antes).
  const handleOrderStage = (order: Order, stage: ProductStatus) => {
    if (!confirm(`¿Cambiar todo el pedido a "${statusConfig[stage].label}"?`)) return;
    runChange(
      order.id,
      async () => {
        if (order.status === 'cancelled') await ordersApi.updateOrderStatus(order.id, 'pending');
        for (const item of getOrderWorkItems(order)) {
          if (item.status !== stage) {
            await ordersApi.advanceItemStage(order.id, item.itemType, item.itemId, stage);
          }
        }
      },
      `Pedido actualizado a ${statusConfig[stage].label}`
    );
  };

  const handleDeliver = (orderId: string, paymentMethod: PaymentMethod) =>
    runChange(orderId, async () => { await ordersApi.updateOrderStatus(orderId, 'delivered', paymentMethod); }, 'Pedido entregado');

  const handleCancel = (orderId: string) => {
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) return;
    runChange(orderId, async () => { await ordersApi.updateOrderStatus(orderId, 'cancelled'); }, 'Pedido cancelado');
  };

  const handleMarkAtStore = (orderId: string) =>
    runChange(orderId, async () => { await ordersApi.markOrderAtStore(orderId); }, 'Pedido marcado como trasladado a tienda');

  const resetFilters = () => {
    setDateMode('from_today');
    setDay(getLocalDateString());
    setFrom('');
    setTo('');
    setStatus('all');
    setSearch('');
  };

  const describe = (o: Order) =>
    [
      ...o.customCakes.map(c => `${c.portions}p ${c.cakeFlavor}`),
      ...(o.sweetTableCombos || []).map(c => `Mesa dulce (${c.totalQuantity} postres)`),
      ...(o.sweetTableExtras || []).map(e => `${e.quantity} ${e.product?.name || e.productName}`),
      ...o.items.map(i => `${i.quantity} ${i.productName}`),
    ].join(', ');

  const sorted = useMemo(
    () => [...orders].sort((a, b) =>
      a.pickupDate.getTime() - b.pickupDate.getTime() || (a.pickupTime || '99:99').localeCompare(b.pickupTime || '99:99')),
    [orders]
  );

  const canCancel = selected && selected.status !== 'delivered' && selected.status !== 'cancelled';

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Administrar pedidos</h1>
          <p className="text-sm sm:text-base">Historial, materiales, estados y cancelaciones</p>
        </div>

        <Card className="mx-4 sm:mx-0">
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre o teléfono..."
                  className="pl-10"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(statusConfig).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="shrink-0" onClick={resetFilters} title="Restablecer filtros">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <Select value={dateMode} onValueChange={v => setDateMode(v as DateMode)}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Tipo de fecha">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="from_today">De hoy en adelante</SelectItem>
                  <SelectItem value="day">Una fecha</SelectItem>
                  <SelectItem value="range">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>

              {dateMode === 'day' && (
                <Input type="date" aria-label="Fecha" className="w-full sm:w-44" value={day} onChange={e => setDay(e.target.value)} />
              )}
              {dateMode === 'range' && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    Desde
                    <Input type="date" aria-label="Desde" className="w-full sm:w-44" value={from} onChange={e => setFrom(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Hasta
                    <Input type="date" aria-label="Hasta" className="w-full sm:w-44" value={to} onChange={e => setTo(e.target.value)} />
                  </label>
                </>
              )}
            </div>
            {rangeInvalid && <p className="text-sm text-destructive">La fecha "Desde" no puede ser posterior a "Hasta".</p>}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">No se encontraron pedidos</TableCell>
                    </TableRow>
                  ) : (
                    sorted.map(order => {
                      const config = statusConfig[order.status];
                      const Icon = config.icon;
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openOrder(order)}>
                          <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                          <TableCell>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm">{order.customerPhone}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium whitespace-nowrap">{format(order.pickupDate, 'dd MMM yyyy', { locale: es })}</p>
                            <p className="text-sm">{order.pickupTime}</p>
                          </TableCell>
                          <TableCell><p className="text-sm max-w-xs">{describe(order)}</p></TableCell>
                          <TableCell><p className="font-bold">Bs. {order.total}</p></TableCell>
                          <TableCell>
                            <Badge className={`${config.color} w-auto`}>
                              <Icon className="h-3 w-3 mr-1 inline" />
                              {config.label}
                            </Badge>
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

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Pedido #{selected?.orderNumber}</DialogTitle>
            </DialogHeader>
            {selected && (
              <OrderDetail
                order={selected}
                onDeliver={selected.status !== 'cancelled' ? handleDeliver : undefined}
                onMarkAtStore={handleMarkAtStore}
              >
                <OrderStatusControls
                  order={selected}
                  disabled={busy}
                  onOrderStage={stage => handleOrderStage(selected, stage)}
                  onItemStage={(item, stage) => handleItemStage(selected, item, stage)}
                />
                <OrderHistorySection key={`h-${selected.id}-${selected.status}`} orderId={selected.id} ordersApi={ordersApi} />
                <MaterialUsageSection
                  orderId={selected.id}
                  canRegister={selected.status !== 'delivered' && selected.status !== 'cancelled'}
                  materialsApi={materialsApi}
                  inventoryApi={inventoryApi}
                />
                {canCancel && (
                  <div className="border-t pt-3 sm:pt-4">
                    <Button
                      onClick={() => handleCancel(selected.id)}
                      disabled={busy}
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Pedido
                    </Button>
                  </div>
                )}
              </OrderDetail>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

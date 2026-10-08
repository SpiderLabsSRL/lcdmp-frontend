import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import type { Order, ProductStatus } from '@/types';
import { getLocalDateString, parseLocalDate } from '@/utils/DateUtils';

const hasLineInStage = (order: Order, stage: ProductStatus): boolean => {
  const cakes = order.customCakes || [];
  const items = order.items || [];
  const comboProducts = (order.sweetTableCombos || []).flatMap(c => c.products || []);
  const extras = order.sweetTableExtras || [];
  return (
    cakes.some(c => c.status === stage) ||
    items.some(i => i.status === stage) ||
    comboProducts.some(p => p.status === stage) ||
    extras.some(e => e.status === stage)
  );
};

interface UseOrdersSocketOptions {
  /**
   * Lista de status que esta vista debe mostrar.
   * Si se omite, acepta todos los pedidos (útil para la vista Orders general).
   * Mutuamente excluyente con itemStageFilter.
   */
  statusFilter?: string[];

  /**
   * Etapa de LÍNEA (torta/producto/item de combo/extra) que esta vista debe
   * mostrar — usado por las pantallas de área (Hornos/Armado/Decoración), ya
   * que un pedido puede tener líneas en distintas etapas a la vez. Un pedido
   * se muestra si CUALQUIERA de sus líneas está en esta etapa, sin importar
   * el status (derivado) del pedido completo. Mutuamente excluyente con
   * statusFilter.
   */
  itemStageFilter?: ProductStatus;

  /**
   * Tipo de pedido a excluir siempre, sin importar el filtro anterior — usado
   * por Orders.tsx/Delivery.tsx para que un pedido interno de reposición de
   * stock ('restock', creado automáticamente al vender un producto) nunca
   * aparezca ahí en tiempo real, igual que ya se excluye en la carga inicial.
   * Mutuamente excluyente con orderTypeFilter.
   */
  excludeOrderType?: string;

  /**
   * Lo opuesto a excludeOrderType: solo muestra pedidos de este tipo — usado
   * por la pantalla de Reposición, que solo debe reaccionar a pedidos
   * internos 'restock' (junto con statusFilter: ['ready']). Mutuamente
   * excluyente con excludeOrderType.
   */
  orderTypeFilter?: string;

  /**
   * Lista inicial de pedidos (cargada via REST al montar el componente).
   * El hook la usa como estado base y la actualiza con los eventos del socket.
   */
  initialOrders?: Order[];
}

interface UseOrdersSocketResult {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  isConnected: boolean;
}

/**
 * Hook que mantiene sincronizada la lista de pedidos con el servidor
 * mediante eventos Socket.IO. Escucha:
 *  - order:created       → agrega si pasa el filtro de status
 *  - order:updated       → actualiza el pedido existente
 *  - order:status_changed → remueve o agrega según si el nuevo status
 *                           coincide con el filtro de la vista
 *  - order:deleted       → remueve el pedido del listado
 */
export const useOrdersSocket = ({
  statusFilter,
  itemStageFilter,
  excludeOrderType,
  orderTypeFilter,
  initialOrders = [],
}: UseOrdersSocketOptions = {}): UseOrdersSocketResult => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isConnected, setIsConnected] = useState(false);
  const statusFilterRef = useRef(statusFilter);
  const itemStageFilterRef = useRef(itemStageFilter);
  const excludeOrderTypeRef = useRef(excludeOrderType);
  const orderTypeFilterRef = useRef(orderTypeFilter);

  // Mantener las refs actualizadas sin re-suscribir
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  useEffect(() => {
    itemStageFilterRef.current = itemStageFilter;
  }, [itemStageFilter]);

  useEffect(() => {
    excludeOrderTypeRef.current = excludeOrderType;
  }, [excludeOrderType]);

  useEffect(() => {
    orderTypeFilterRef.current = orderTypeFilter;
  }, [orderTypeFilter]);

  // Sincronizar cuando cambia initialOrders (por la carga inicial REST)
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const parseOrder = useCallback((raw: any): Order => ({
    ...raw,
    pickupDate: raw.pickupDate
      ? parseLocalDate(raw.pickupDate)
      : new Date(),
    createdAt: raw.createdAt
      ? new Date(raw.createdAt)
      : new Date(),
  }), []);
  const matchesFilter = useCallback((status: string): boolean => {
    if (!statusFilterRef.current || statusFilterRef.current.length === 0) return true;
    return statusFilterRef.current.includes(status);
  }, []);
  const matchesOrder = useCallback((order: Order): boolean => {
    if (excludeOrderTypeRef.current && order.orderType === excludeOrderTypeRef.current) {
      return false;
    }
    if (orderTypeFilterRef.current && order.orderType !== orderTypeFilterRef.current) {
      return false;
    }
    if (itemStageFilterRef.current) {
      return hasLineInStage(order, itemStageFilterRef.current);
    }
    return matchesFilter(order.status);
  }, [matchesFilter]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Nuevo pedido creado
    const onOrderCreated = (rawOrder: any) => {
      const order = parseOrder(rawOrder);
      if (!matchesOrder(order)) return;

      setOrders((prev) => {
        // Evitar duplicados
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    };

    // Pedido actualizado (datos generales, no estado)
    const onOrderUpdated = (rawOrder: any) => {
      const order = parseOrder(rawOrder);

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (!exists) return prev;
        return prev.map((o) => (o.id === order.id ? order : o));
      });
    };

    // Cambio de estado — la clave: aparece o desaparece según el filtro
    const onOrderStatusChanged = ({ id, order: rawOrder }: {
      id: string;
      status: string;
      order: any;
    }) => {
      const order = parseOrder(rawOrder);
      const shouldShow = matchesOrder(order);

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === id);

        if (shouldShow && exists) {
          // Actualizar en el listado
          return prev.map((o) => (o.id === id ? order : o));
        }
        if (shouldShow && !exists) {
          // Agregar al listado
          return [order, ...prev];
        }
        if (!shouldShow && exists) {
          // Remover del listado
          return prev.filter((o) => o.id !== id);
        }
        // No existe y no corresponde → no hacer nada
        return prev;
      });
    };

    // Una línea (torta/producto/item de combo/extra) cambió de etapa — la
    // clave para las pantallas de área: el pedido aparece o desaparece según
    // si CUALQUIERA de sus líneas sigue estando en la etapa filtrada.
    const onItemStageChanged = ({ orderId, order: rawOrder }: {
      orderId: string;
      itemType: string;
      itemId: string;
      stage: string;
      order: any;
    }) => {
      const order = parseOrder(rawOrder);
      const shouldShow = matchesOrder(order);

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === orderId);

        if (shouldShow && exists) {
          return prev.map((o) => (o.id === orderId ? order : o));
        }
        if (shouldShow && !exists) {
          return [order, ...prev];
        }
        if (!shouldShow && exists) {
          return prev.filter((o) => o.id !== orderId);
        }
        return prev;
      });
    };

    // Pedido eliminado
    const onOrderDeleted = ({ id }: { id: string }) => {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    };

    // Registrar listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("order:created", onOrderCreated);
    socket.on("order:updated", onOrderUpdated);
    socket.on("order:status_changed", onOrderStatusChanged);
    socket.on("order:item_stage_changed", onItemStageChanged);
    socket.on("order:deleted", onOrderDeleted);

    // Estado inicial de conexión
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order:created", onOrderCreated);
      socket.off("order:updated", onOrderUpdated);
      socket.off("order:status_changed", onOrderStatusChanged);
      socket.off("order:item_stage_changed", onItemStageChanged);
      socket.off("order:deleted", onOrderDeleted);
    };
  }, [parseOrder, matchesFilter, matchesOrder]);

  return { orders, setOrders, isConnected };
};

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import type { Order } from '@/types';

interface UseOrdersSocketOptions {
  /**
   * Lista de status que esta vista debe mostrar.
   * Si se omite, acepta todos los pedidos (útil para la vista Orders general).
   */
  statusFilter?: string[];

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
  initialOrders = [],
}: UseOrdersSocketOptions = {}): UseOrdersSocketResult => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isConnected, setIsConnected] = useState(false);
  const statusFilterRef = useRef(statusFilter);

  // Mantener la ref actualizada sin re-suscribir
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  // Sincronizar cuando cambia initialOrders (por la carga inicial REST)
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const parseOrder = useCallback((raw: any): Order => ({
    ...raw,
    pickupDate: raw.pickupDate ? new Date(raw.pickupDate) : new Date(),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
  }), []);

  const matchesFilter = useCallback((status: string): boolean => {
    if (!statusFilterRef.current || statusFilterRef.current.length === 0) return true;
    return statusFilterRef.current.includes(status);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Nuevo pedido creado
    const onOrderCreated = (rawOrder: any) => {
      const order = parseOrder(rawOrder);
      if (!matchesFilter(order.status)) return;

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
    const onOrderStatusChanged = ({ id, status, order: rawOrder }: {
      id: string;
      status: string;
      order: any;
    }) => {
      const order = parseOrder(rawOrder);
      const shouldShow = matchesFilter(status);

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
    socket.on("order:deleted", onOrderDeleted);

    // Estado inicial de conexión
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order:created", onOrderCreated);
      socket.off("order:updated", onOrderUpdated);
      socket.off("order:status_changed", onOrderStatusChanged);
      socket.off("order:deleted", onOrderDeleted);
    };
  }, [parseOrder, matchesFilter]);

  return { orders, setOrders, isConnected };
};

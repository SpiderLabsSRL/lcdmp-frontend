import type { Order, WorkItem, ProductStatus } from '@/types';

// Aplana las 4 fuentes de líneas de producción de un pedido (tortas
// personalizadas, productos de catálogo, productos dentro de una mesa dulce,
// y postres adicionales de mesa dulce) en una lista plana de WorkItem,
// filtrando solo las que están en la etapa pedida. Reutilizado por
// Hornos/Armado/Decoración para renderizar una tarjeta por línea en vez de
// una tarjeta por pedido completo.
export function getWorkItemsAtStage(orders: Order[], stage: ProductStatus): WorkItem[] {
  const items: WorkItem[] = [];

  for (const order of orders) {
    for (const cake of order.customCakes || []) {
      if (cake.status !== stage) continue;
      items.push({
        itemType: 'custom_cake',
        itemId: cake.id,
        order,
        status: cake.status,
        title: `${cake.portions} porciones - ${cake.cakeFlavor}${cake.secondCakeFlavor ? `/${cake.secondCakeFlavor}` : ''}`,
        detail: cake.shape,
        quantity: cake.quantity || 1,
      });
    }

    for (const item of order.items || []) {
      if (item.status !== stage || !item.id) continue;
      items.push({
        itemType: 'order_item',
        itemId: item.id,
        order,
        status: item.status,
        title: `${item.quantity} ${item.productName || item.product?.name || 'Producto'}`,
        quantity: item.quantity,
        notes: item.notes,
      });
    }

    for (const combo of order.sweetTableCombos || []) {
      for (const product of combo.products || []) {
        if (product.status !== stage || !product.id) continue;
        items.push({
          itemType: 'combo_item',
          itemId: product.id,
          order,
          status: product.status,
          title: `Mesa dulce: ${product.quantity} ${product.productName || product.product?.name || ''}`,
          detail: combo.details,
          quantity: product.quantity,
        });
      }
    }

    for (const extra of order.sweetTableExtras || []) {
      if (extra.status !== stage || !extra.id) continue;
      items.push({
        itemType: 'sweet_table_extra',
        itemId: extra.id,
        order,
        status: extra.status,
        title: `Mesa dulce: ${extra.quantity} ${extra.productName || extra.product?.name || ''}`,
        quantity: extra.quantity,
        notes: extra.notes,
      });
    }
  }

  return items;
}

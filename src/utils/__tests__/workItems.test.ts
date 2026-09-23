import { describe, it, expect } from 'vitest';
import { getWorkItemsAtStage } from '../workItems';
import type { Order, CustomCake, OrderItem, OrderCombo, ComboProduct } from '@/types';

const makeCake = (overrides: Partial<CustomCake> = {}): CustomCake => ({
  id: 'cake-1',
  portions: 20,
  cakeFlavor: 'Chocolate',
  secondCakeFlavor: '',
  fillingFlavor: 'Dulce de leche',
  secondFillingFlavor: '',
  referenceImages: [],
  price: 100,
  quantity: 1,
  status: 'baking',
  ...overrides,
});

const makeItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  productId: 'p1',
  product: { id: 'p1', name: 'Cupcake' } as any,
  productName: 'Cupcake',
  quantity: 2,
  price: 10,
  status: 'baking',
  ...overrides,
});

const makeComboProduct = (overrides: Partial<ComboProduct> = {}): ComboProduct => ({
  id: 'combo-prod-1',
  productId: 'p2',
  productName: 'Alfajor',
  quantity: 5,
  pricePerUnit: 3,
  status: 'baking',
  ...overrides,
});

const makeCombo = (overrides: Partial<OrderCombo> = {}, products: ComboProduct[] = [makeComboProduct()]): OrderCombo => ({
  id: 'combo-1',
  name: 'Combo 50',
  products,
  totalQuantity: 50,
  price: 400,
  details: 'Mesa dulce grande',
  ...overrides,
});

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  orderNumber: 'ORD-1',
  orderType: 'cake',
  customerName: 'Juan',
  customerPhone: '70000000',
  pickupDate: new Date(2026, 8, 25),
  pickupTime: '10:00',
  status: 'baking',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 0,
  total: 100,
  createdAt: new Date(2026, 8, 20),
  createdBy: 'u1',
  ...overrides,
});

describe('getWorkItemsAtStage', () => {
  it('returns an empty array for an empty orders list', () => {
    expect(getWorkItemsAtStage([], 'baking')).toEqual([]);
  });

  it('includes a custom cake at the target stage with the right title/quantity', () => {
    const cake = makeCake({ id: 'c1', portions: 30, cakeFlavor: 'Vainilla', quantity: 2, shape: 'Redonda' });
    const order = makeOrder({ customCakes: [cake] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemType: 'custom_cake',
      itemId: 'c1',
      order,
      status: 'baking',
      title: '30 porciones - Vainilla',
      detail: 'Redonda',
      quantity: 2,
    });
  });

  it('includes both flavors in the title when a second cake flavor is set', () => {
    const cake = makeCake({ id: 'c1', cakeFlavor: 'Chocolate', secondCakeFlavor: 'Vainilla' });
    const order = makeOrder({ customCakes: [cake] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result[0].title).toBe('20 porciones - Chocolate/Vainilla');
  });

  it('excludes items at other stages', () => {
    const cake = makeCake({ id: 'c1', status: 'decorating' });
    const item = makeItem({ id: 'i1', status: 'assembling' });
    const order = makeOrder({ customCakes: [cake], items: [item] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(0);
  });

  it('includes an order_item at the target stage', () => {
    const item = makeItem({ id: 'i1', status: 'baking', productName: 'Cupcake', quantity: 4, notes: 'Sin nueces' });
    const order = makeOrder({ items: [item] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemType: 'order_item',
      itemId: 'i1',
      status: 'baking',
      title: 'Cupcake',
      quantity: 4,
      notes: 'Sin nueces',
    });
  });

  it('skips an order_item without an id even if its status matches', () => {
    const item = makeItem({ id: undefined, status: 'baking' });
    const order = makeOrder({ items: [item] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(0);
  });

  it('includes a sweet-table-combo product at the target stage as combo_item', () => {
    const product = makeComboProduct({ id: 'cp1', status: 'baking', quantity: 10, productName: 'Alfajor' });
    const combo = makeCombo({ details: 'Mesa dulce XL' }, [product]);
    const order = makeOrder({ sweetTableCombos: [combo] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemType: 'combo_item',
      itemId: 'cp1',
      status: 'baking',
      title: 'Mesa dulce: 10 Alfajor',
      detail: 'Mesa dulce XL',
      quantity: 10,
    });
  });

  it('skips a combo product without an id even if its status matches', () => {
    const product = makeComboProduct({ id: undefined, status: 'baking' });
    const combo = makeCombo({}, [product]);
    const order = makeOrder({ sweetTableCombos: [combo] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(0);
  });

  it('includes a sweet-table extra at the target stage as sweet_table_extra', () => {
    const extra = makeItem({ id: 'e1', status: 'baking', productName: 'Brownie', quantity: 8, notes: 'Extra choco' });
    const order = makeOrder({ sweetTableExtras: [extra] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemType: 'sweet_table_extra',
      itemId: 'e1',
      status: 'baking',
      title: 'Mesa dulce: 8 Brownie',
      quantity: 8,
      notes: 'Extra choco',
    });
  });

  it('skips a sweet-table extra without an id even if its status matches', () => {
    const extra = makeItem({ id: undefined, status: 'baking' });
    const order = makeOrder({ sweetTableExtras: [extra] });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(0);
  });

  it('contributes nothing for an order with zero matching lines', () => {
    const order = makeOrder({
      customCakes: [makeCake({ id: 'c1', status: 'decorating' })],
      items: [makeItem({ id: 'i1', status: 'ready' })],
      sweetTableCombos: [makeCombo({}, [makeComboProduct({ id: 'cp1', status: 'assembling' })])],
      sweetTableExtras: [makeItem({ id: 'e1', status: 'delivered' })],
    });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(0);
  });

  it('scans multiple orders and concatenates results in order', () => {
    const order1 = makeOrder({
      id: 'order-1',
      customCakes: [makeCake({ id: 'c1', status: 'baking' })],
    });
    const order2 = makeOrder({
      id: 'order-2',
      items: [makeItem({ id: 'i1', status: 'baking' })],
    });

    const result = getWorkItemsAtStage([order1, order2], 'baking');

    expect(result).toHaveLength(2);
    expect(result[0].itemType).toBe('custom_cake');
    expect(result[0].order.id).toBe('order-1');
    expect(result[1].itemType).toBe('order_item');
    expect(result[1].order.id).toBe('order-2');
  });

  it('flattens multiple lines across categories for a single order', () => {
    const order = makeOrder({
      customCakes: [makeCake({ id: 'c1', status: 'baking' })],
      items: [makeItem({ id: 'i1', status: 'baking' }), makeItem({ id: 'i2', status: 'ready' })],
      sweetTableCombos: [makeCombo({}, [makeComboProduct({ id: 'cp1', status: 'baking' })])],
      sweetTableExtras: [makeItem({ id: 'e1', status: 'baking' })],
    });

    const result = getWorkItemsAtStage([order], 'baking');

    expect(result).toHaveLength(4);
    expect(result.map((r) => r.itemType)).toEqual([
      'custom_cake',
      'order_item',
      'combo_item',
      'sweet_table_extra',
    ]);
  });
});

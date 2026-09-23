import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderDetail from '../OrderDetail';
import type { Order, ItemStageLogEntry } from '@/types';
import type { IOrdersApi } from '@/api/OrdersApi';

const makeOrdersApi = (overrides: Partial<IOrdersApi> = {}): IOrdersApi => ({
  getOrders: vi.fn(),
  getOrderById: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  deleteOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  advanceItemStage: vi.fn(),
  getOrderProductionLog: vi.fn().mockResolvedValue([]),
  getFlavors: vi.fn(),
  getProducts: vi.fn(),
  getSweetTableCombos: vi.fn(),
  ...overrides,
});

const baseOrder: Order = {
  id: 'order-1',
  orderNumber: 'ORD-1',
  orderType: 'mixed',
  customerName: 'Ana Pérez',
  customerPhone: '70011122',
  pickupDate: new Date(2026, 5, 20),
  pickupTime: '15:00',
  status: 'pending',
  items: [],
  customCakes: [],
  sweetTableCombos: [],
  sweetTableExtras: [],
  deliveryCost: 0,
  deposit: 100,
  total: 500,
  createdAt: new Date(2026, 0, 1),
  createdBy: 'u1',
  createdByUsername: 'admin',
};

// A "full" order that exercises every conditionally-rendered section.
const fullOrder: Order = {
  ...baseOrder,
  customCakes: [
    {
      id: 'cake-1',
      portions: 30,
      quantity: 2,
      price: 150,
      shape: 'Redonda',
      design: 'Flores rosadas',
      dedication: 'Feliz cumpleaños',
      cakeFlavor: 'Chocolate',
      secondCakeFlavor: 'Vainilla',
      fillingFlavor: 'Dulce de leche',
      secondFillingFlavor: 'Frutilla',
      referenceImages: ['img1.png', 'img2.png'],
    },
  ],
  items: [
    {
      productId: 'p1',
      product: { id: 'p1', name: 'Alfajores' } as any,
      productName: 'Alfajores',
      quantity: 6,
      price: 10,
      notes: 'Sin azúcar',
    },
  ],
  sweetTableCombos: [
    {
      id: 'combo-1',
      name: 'Mesa dulce 50',
      totalQuantity: 50,
      price: 400,
      details: 'Incluye mantel',
      products: [
        { productId: 'p2', product: { id: 'p2', name: 'Brownies' } as any, quantity: 20, pricePerUnit: 5 },
      ],
    },
  ],
  sweetTableExtras: [
    {
      productId: 'p3',
      product: { id: 'p3', name: 'Cupcakes extra' } as any,
      productName: 'Cupcakes extra',
      quantity: 4,
      price: 8,
    },
  ],
  deliveryAddress: 'Av. Siempre Viva 123',
  deliveryCost: 30,
  guarantee: { items: 'Fuentes y bandejas', amount: 50 },
  couponCode: 'PROMO10',
  discount: 25,
  notes: 'Entregar antes de las 3pm',
  depositMethod: 'qr',
  deposit: 200,
  total: 900,
};

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders customer and delivery information', () => {
    render(<OrderDetail order={baseOrder} />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('70011122')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('renders the status badge and creator username', () => {
    render(<OrderDetail order={baseOrder} />);

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Creado por: admin')).toBeInTheDocument();
  });

  it('does not render the deliver button when the order is already delivered', () => {
    render(<OrderDetail order={{ ...baseOrder, status: 'delivered' }} onDeliver={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Marcar como Entregado/ })).not.toBeInTheDocument();
  });

  it('does not render the deliver button when onDeliver is not provided', () => {
    render(<OrderDetail order={baseOrder} />);

    expect(screen.queryByRole('button', { name: /Marcar como Entregado/ })).not.toBeInTheDocument();
  });

  it('renders the deliver button when the order is pending and onDeliver is provided', () => {
    render(<OrderDetail order={baseOrder} onDeliver={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Marcar como Entregado/ })).toBeInTheDocument();
  });

  describe('conditional sections - absent', () => {
    it('does not render any of the optional sections for a minimal order', () => {
      render(<OrderDetail order={baseOrder} />);

      expect(screen.queryByText('Tortas personalizadas')).not.toBeInTheDocument();
      expect(screen.queryByText('Productos del catálogo')).not.toBeInTheDocument();
      expect(screen.queryByText('Mesas Dulces')).not.toBeInTheDocument();
      expect(screen.queryByText('Mesa Dulce')).not.toBeInTheDocument();
      expect(screen.queryByText('Información de envío')).not.toBeInTheDocument();
      expect(screen.queryByText('Garantía')).not.toBeInTheDocument();
      expect(screen.queryByText(/Cupón aplicado/)).not.toBeInTheDocument();
      expect(screen.queryByText('Notas adicionales')).not.toBeInTheDocument();
      expect(screen.queryByText(/Método de pago del adelanto/)).not.toBeInTheDocument();
    });
  });

  describe('conditional sections - present', () => {
    it('renders the custom cakes section with flavors, shape, design and dedication', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Tortas personalizadas')).toBeInTheDocument();
      expect(screen.getByText('2 x 30 porciones')).toBeInTheDocument();
      expect(screen.getByText(/Sabores: Chocolate \/ Vainilla/)).toBeInTheDocument();
      expect(screen.getByText(/Rellenos: Dulce de leche \/ Frutilla/)).toBeInTheDocument();
      expect(screen.getByText('Forma: Redonda')).toBeInTheDocument();
      expect(screen.getByText('Diseño: Flores rosadas')).toBeInTheDocument();
      expect(screen.getByText('"Feliz cumpleaños"')).toBeInTheDocument();
      expect(screen.getByText('2 imágenes de referencia')).toBeInTheDocument();
      // price shown is unit price * quantity = 150 * 2 = 300
      expect(screen.getByText('Bs. 300')).toBeInTheDocument();
    });

    it('renders the catalog items section with notes', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Productos del catálogo')).toBeInTheDocument();
      expect(screen.getByText('6 x Alfajores')).toBeInTheDocument();
      expect(screen.getByText('Sin azúcar')).toBeInTheDocument();
    });

    it('renders the sweet table combos section with nested products', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Mesas Dulces')).toBeInTheDocument();
      expect(screen.getByText('Mesa dulce 50 — 50 postres')).toBeInTheDocument();
      expect(screen.getByText('20 x Brownies')).toBeInTheDocument();
      expect(screen.getByText('Incluye mantel')).toBeInTheDocument();
    });

    it('renders the sweet table extras section', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('4 x Cupcakes extra')).toBeInTheDocument();
    });

    it('renders the delivery information section', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Información de envío')).toBeInTheDocument();
      expect(screen.getByText('Dirección: Av. Siempre Viva 123')).toBeInTheDocument();
      expect(screen.getByText('Costo de envío: Bs. 30')).toBeInTheDocument();
    });

    it('renders the guarantee section', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Garantía')).toBeInTheDocument();
      expect(screen.getByText('Artículos: Fuentes y bandejas')).toBeInTheDocument();
      expect(screen.getByText('Valor: Bs. 50')).toBeInTheDocument();
    });

    it('renders the coupon/discount section', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Cupón aplicado: PROMO10')).toBeInTheDocument();
      expect(screen.getByText('Descuento: Bs. 25')).toBeInTheDocument();
    });

    it('renders additional notes', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Notas adicionales')).toBeInTheDocument();
      expect(screen.getByText('Entregar antes de las 3pm')).toBeInTheDocument();
    });

    it('renders the deposit payment method when present', () => {
      render(<OrderDetail order={fullOrder} />);

      expect(screen.getByText('Método de pago del adelanto:')).toBeInTheDocument();
      expect(screen.getByText('qr')).toBeInTheDocument();
    });
  });

  describe('totals', () => {
    it('computes and renders the subtotal, delivery cost, discount and balances', () => {
      render(<OrderDetail order={fullOrder} />);

      // subtotal = total + discount - deliveryCost = 900 + 25 - 30 = 895
      expect(screen.getByText('Bs. 895')).toBeInTheDocument();
      expect(screen.getByText('+ Bs. 30')).toBeInTheDocument();
      expect(screen.getByText('- Bs. 25')).toBeInTheDocument();
      expect(screen.getByText('Bs. 900')).toBeInTheDocument();
      expect(screen.getByText('Bs. 200')).toBeInTheDocument(); // deposit
      expect(screen.getByText('Bs. 700')).toBeInTheDocument(); // pending balance
    });
  });

  describe('cancel order', () => {
    it('does not render the cancel button when onCancel is not provided', () => {
      render(<OrderDetail order={baseOrder} />);

      expect(screen.queryByRole('button', { name: /Cancelar Pedido/ })).not.toBeInTheDocument();
    });

    it('renders the cancel button for a pending order when onCancel is provided', () => {
      render(<OrderDetail order={baseOrder} onCancel={vi.fn()} />);

      expect(screen.getByRole('button', { name: /Cancelar Pedido/ })).toBeInTheDocument();
    });

    it('does not render the cancel button when the order is already delivered', () => {
      render(<OrderDetail order={{ ...baseOrder, status: 'delivered' }} onCancel={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /Cancelar Pedido/ })).not.toBeInTheDocument();
    });

    it('does not render the cancel button when the order is already cancelled', () => {
      render(<OrderDetail order={{ ...baseOrder, status: 'cancelled' }} onCancel={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /Cancelar Pedido/ })).not.toBeInTheDocument();
    });

    it('calls onCancel with the order id when confirmed', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<OrderDetail order={baseOrder} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /Cancelar Pedido/ }));

      expect(onCancel).toHaveBeenCalledWith('order-1');
    });

    it('does not call onCancel when the confirm prompt is declined', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<OrderDetail order={baseOrder} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /Cancelar Pedido/ }));

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('per-line status badges', () => {
    it('renders a status badge next to a custom cake line when it has a status', () => {
      const order: Order = {
        ...fullOrder,
        customCakes: [{ ...fullOrder.customCakes[0], status: 'decorating' }],
      };
      render(<OrderDetail order={order} />);

      expect(screen.getByText('Decorando')).toBeInTheDocument();
    });

    it('does not render a status badge next to a line without a status', () => {
      render(<OrderDetail order={fullOrder} />);

      // Only the order-level status badge ("Pendiente") should be present.
      expect(screen.getAllByText('Pendiente')).toHaveLength(1);
    });
  });

  describe('production history', () => {
    it('does not fetch the production log until the history section is expanded', () => {
      const ordersApi = makeOrdersApi();
      render(<OrderDetail order={baseOrder} ordersApi={ordersApi} />);

      expect(ordersApi.getOrderProductionLog).not.toHaveBeenCalled();
    });

    it('fetches and renders the production log when expanded', async () => {
      const user = userEvent.setup();
      const log: ItemStageLogEntry[] = [
        {
          id: 'log-1',
          itemType: 'custom_cake',
          itemId: 'cake-1',
          stage: 'baking',
          enteredAt: '2026-05-01T10:00:00.000Z',
          completedAt: '2026-05-01T12:00:00.000Z',
          completedById: 'user-1',
          completedByName: 'Ana',
        },
      ];
      const ordersApi = makeOrdersApi({ getOrderProductionLog: vi.fn().mockResolvedValue(log) });
      render(<OrderDetail order={baseOrder} ordersApi={ordersApi} />);

      await user.click(screen.getByRole('button', { name: /Historial de producción/ }));

      expect(ordersApi.getOrderProductionLog).toHaveBeenCalledWith('order-1');
      await waitFor(() => {
        expect(screen.getByText(/por Ana/)).toBeInTheDocument();
      });
    });

    it('shows an empty-state message when the log has no entries', async () => {
      const user = userEvent.setup();
      const ordersApi = makeOrdersApi({ getOrderProductionLog: vi.fn().mockResolvedValue([]) });
      render(<OrderDetail order={baseOrder} ordersApi={ordersApi} />);

      await user.click(screen.getByRole('button', { name: /Historial de producción/ }));

      await waitFor(() => {
        expect(screen.getByText('Sin historial de producción todavía.')).toBeInTheDocument();
      });
    });

    it('collapses the history section when toggled again, without re-fetching', async () => {
      const user = userEvent.setup();
      const ordersApi = makeOrdersApi();
      render(<OrderDetail order={baseOrder} ordersApi={ordersApi} />);

      const toggle = screen.getByRole('button', { name: /Historial de producción/ });
      await user.click(toggle);
      await waitFor(() => expect(ordersApi.getOrderProductionLog).toHaveBeenCalledTimes(1));

      await user.click(toggle);
      expect(screen.queryByText('Sin historial de producción todavía.')).not.toBeInTheDocument();

      await user.click(toggle);
      await waitFor(() => expect(ordersApi.getOrderProductionLog).toHaveBeenCalledTimes(1));
    });
  });

  describe('confirm delivery sub-dialog', () => {
    it('opens the confirm delivery dialog when "Marcar como Entregado" is clicked', async () => {
      const user = userEvent.setup();
      render(<OrderDetail order={baseOrder} onDeliver={vi.fn()} />);

      expect(screen.queryByText('Confirmar entrega del pedido')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Marcar como Entregado/ }));

      expect(screen.getByText('Confirmar entrega del pedido')).toBeInTheDocument();
    });

    it('defaults the payment method to cash and calls onDeliver with "cash" on confirm', async () => {
      const user = userEvent.setup();
      const onDeliver = vi.fn();
      render(<OrderDetail order={baseOrder} onDeliver={onDeliver} />);

      await user.click(screen.getByRole('button', { name: /Marcar como Entregado/ }));
      await user.click(screen.getByRole('button', { name: 'Confirmar Entrega' }));

      expect(onDeliver).toHaveBeenCalledWith('order-1', 'cash');
    });

    it('calls onDeliver with "qr" when the QR payment method is selected before confirming', async () => {
      const user = userEvent.setup();
      const onDeliver = vi.fn();
      render(<OrderDetail order={baseOrder} onDeliver={onDeliver} />);

      await user.click(screen.getByRole('button', { name: /Marcar como Entregado/ }));
      await user.click(screen.getByRole('button', { name: 'QR' }));
      await user.click(screen.getByRole('button', { name: 'Confirmar Entrega' }));

      expect(onDeliver).toHaveBeenCalledWith('order-1', 'qr');
    });

    it('closes the sub-dialog and does not call onDeliver when Cancelar is clicked', async () => {
      const user = userEvent.setup();
      const onDeliver = vi.fn();
      render(<OrderDetail order={baseOrder} onDeliver={onDeliver} />);

      await user.click(screen.getByRole('button', { name: /Marcar como Entregado/ }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(onDeliver).not.toHaveBeenCalled();
      expect(screen.queryByText('Confirmar entrega del pedido')).not.toBeInTheDocument();
    });

    it('shows the pending balance inside the confirm dialog', async () => {
      const user = userEvent.setup();
      render(<OrderDetail order={{ ...baseOrder, total: 500, deposit: 100 }} onDeliver={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /Marcar como Entregado/ }));

      const dialog = screen.getByText('Confirmar entrega del pedido').closest('[role="dialog"]') as HTMLElement;
      expect(within(dialog).getByText('Bs. 400')).toBeInTheDocument(); // 500 - 100
    });
  });
});

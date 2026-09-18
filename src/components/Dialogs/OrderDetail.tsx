import { Order } from "@/types";
import { format } from 'date-fns';
import { Badge, Truck } from "lucide-react";
import { statusConfig } from '@/types/consts';
import { es } from "date-fns/locale";
import { Button } from "../ui/button";
import { PaymentMethod } from '../../types/index';
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Banknote, QrCode } from "lucide-react";
import { getOrderType } from "@/pages/Orders";

interface OrderDetailProps {
  order: Order;
  onDeliver?: (orderId: string, paymentMethod: PaymentMethod) => void;
}

export default function OrderDetail({ order, onDeliver }: OrderDetailProps) {
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const handleDeliverClick = () => {
    setShowDeliverDialog(true);
  };

  const handleConfirmDeliver = () => {
    if (onDeliver) {
      onDeliver(order.id, paymentMethod);
      setShowDeliverDialog(false);
      setPaymentMethod('cash');
    }
  };

  const handleCancelDeliver = () => {
    setShowDeliverDialog(false);
    setPaymentMethod('cash');
  };

  return (
    <>
      <div className="space-y-3 sm:space-y-4 px-1">
        {/* Información del cliente y entrega */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <p className="text-sm text-foreground">Cliente</p>
            <p className="font-semibold text-base text-foreground">{order.customerName}</p>
            <p className="text-sm text-foreground">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-sm text-foreground">Entrega</p>
            <p className="font-semibold text-base text-foreground">
              {format(order.pickupDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
            <p className="text-sm text-foreground">{order.pickupTime}</p>
          </div>
        </div>

        {/* Botón de entregar */}
        {order.status !== 'delivered' && onDeliver && (
          <div className="border-t pt-3 sm:pt-4">
            <Button 
              onClick={handleDeliverClick}
              className="w-full"
            >
              <Truck className="h-4 w-4 mr-2" />
              Marcar como Entregado
            </Button>
          </div>
        )}

      {/* Tortas personalizadas */}
      {order.customCakes.length > 0 && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Tortas personalizadas</h4>
          {order.customCakes.map((cake, i) => (
            <div key={i} className="bg-muted/50 p-3 rounded-lg mb-2">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-base text-foreground">
                    {cake.quantity > 1 ? `${cake.quantity} x ` : ''}
                    {cake.portions} porciones
                  </p>
                  <p className="text-sm text-foreground mt-1">
                    Sabores: {cake.cakeFlavor}
                    {cake.secondCakeFlavor && ` / ${cake.secondCakeFlavor}`}
                  </p>
                  <p className="text-sm text-foreground">
                    Rellenos: {cake.fillingFlavor}
                    {cake.secondFillingFlavor && ` / ${cake.secondFillingFlavor}`}
                  </p>
                </div>
                <p className="font-bold text-primary">Bs. {cake.price * cake.quantity}</p>
              </div>
              {cake.shape && (
                <p className="text-sm text-foreground">Forma: {cake.shape}</p>
              )}
              {cake.design && (
                <p className="text-sm text-foreground mt-1">Diseño: {cake.design}</p>
              )}
              {cake.dedication && (
                <p className="text-sm italic text-foreground">"{cake.dedication}"</p>
              )}
              {cake.referenceImages && cake.referenceImages.length > 0 && (
                <p className="text-sm text-foreground mt-1">
                  {cake.referenceImages.length} imágenes de referencia
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Productos del catálogo */}
      {order.items.length > 0 && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Productos del catálogo</h4>
          {order.items.map((item, i) => (
            <div key={i} className="bg-muted/50 p-3 rounded-lg mb-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-base text-foreground">
                    {item.quantity} x {item.product?.name || item.productName}
                  </p>
                  {item.notes && (
                    <p className="text-sm text-foreground mt-1">{item.notes}</p>
                  )}
                </div>
                <p className="font-semibold text-foreground">Bs. {item.price * item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mesa Dulce */}
      {(order.sweetTableCombos?.length || 0) > 0 && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Mesas Dulces</h4>
          {order.sweetTableCombos.map((combo, i) => (
            <div key={combo.id || i} className="bg-muted/50 p-3 rounded-lg mb-2">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-base text-foreground">{combo.name || 'Mesa dulce'} — {combo.totalQuantity} postres</p>
                  {combo.products.length > 0 && (
                    <ul className="text-sm text-foreground mt-1 list-disc list-inside">
                      {combo.products.map((p, pi) => (
                        <li key={pi}>{p.quantity} x {p.product?.name || p.productName}</li>
                      ))}
                    </ul>
                  )}
                  {combo.details && (
                    <p className="text-sm text-foreground mt-1">{combo.details}</p>
                  )}
                </div>
                <p className="font-bold text-primary">Bs. {combo.price}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Postres adicionales de Mesa Dulce */}
      {(order.sweetTableExtras?.length || 0) > 0 && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Mesa Dulce</h4>
          {order.sweetTableExtras.map((extra, i) => (
            <div key={i} className="bg-muted/50 p-3 rounded-lg mb-2">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-base text-foreground">
                  {extra.quantity} x {extra.product?.name || extra.productName}
                </p>
                <p className="font-semibold text-foreground">Bs. {extra.price * extra.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Información de envío */}
      {order.deliveryAddress && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Información de envío</h4>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-foreground">Dirección: {order.deliveryAddress}</p>
            <p className="text-sm text-foreground mt-1">Costo de envío: Bs. {order.deliveryCost}</p>
          </div>
        </div>
      )}

      {/* Garantía */}
      {order.guarantee && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Garantía</h4>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-foreground">Artículos: {order.guarantee.items}</p>
            <p className="text-sm text-foreground mt-1">Valor: Bs. {order.guarantee.amount}</p>
          </div>
        </div>
      )}

      {/* Cupón / Descuento */}
      {order.couponCode && (
        <div className="border-t pt-3 sm:pt-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-foreground">Cupón aplicado: {order.couponCode}</p>
            <p className="text-sm text-foreground">Descuento: Bs. {order.discount || 0}</p>
          </div>
        </div>
      )}

      {/* Notas adicionales */}
      {order.notes && (
        <div className="border-t pt-3 sm:pt-4">
          <h4 className="font-semibold text-base text-foreground mb-2">Notas adicionales</h4>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
          </div>
        </div>
      )}
        
        {/* Totales */}
        <div className="border-t pt-3 sm:pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-foreground">
              <span>Subtotal:</span>
              <span>Bs. {order.total + (order.discount || 0) - (order.deliveryCost || 0)}</span>
            </div>
            {order.deliveryCost > 0 && (
              <div className="flex justify-between text-sm text-foreground">
                <span>Costo de envío:</span>
                <span>+ Bs. {order.deliveryCost}</span>
              </div>
            )}
            {order.discount && order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento:</span>
                <span>- Bs. {order.discount}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <p className="font-semibold text-base text-foreground">Total</p>
              <p className="text-xl font-bold text-primary">Bs. {order.total}</p>
            </div>
            <div className="flex justify-between text-sm text-foreground">
              <span>Adelanto pagado:</span>
              <span className="font-medium">Bs. {order.deposit}</span>
            </div>
            <div className="flex justify-between text-sm text-foreground">
              <span>Saldo pendiente:</span>
              <span className={`font-medium ${order.total - order.deposit > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                Bs. {order.total - order.deposit}
              </span>
            </div>
            {order.depositMethod && (
              <div className="flex justify-between text-sm text-foreground">
                <span>Método de pago del adelanto:</span>
                <span className="uppercase">{order.depositMethod}</span>
              </div>
            )}
          </div>
        </div>

        {/* Estado del pedido */}
        <div className="border-t pt-3 flex flex-wrap justify-between items-center gap-2">
          <Badge className={statusConfig[order.status].color}>
            {statusConfig[order.status].label}
          </Badge>
          <p className="text-sm text-foreground">
            Creado por: {order.createdByUsername}
          </p>
        </div>
      </div>

      {/* Dialog para confirmar entrega */}
      <Dialog open={showDeliverDialog} onOpenChange={setShowDeliverDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar entrega del pedido</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas marcar este pedido como entregado?
              Por favor, selecciona el método de pago del saldo pendiente.
            </DialogDescription>
          </DialogHeader>

          {/* Información del saldo pendiente */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total del pedido:</span>
              <span className="font-medium">Bs. {order.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Adelanto pagado:</span>
              <span className="font-medium text-green-600">Bs. {order.deposit}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Saldo pendiente:</span>
              <span className="font-bold text-lg text-orange-500">
                Bs. {order.total - order.deposit}
              </span>
            </div>
          </div>

          {/* Selección del método de pago */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Método de pago del saldo</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cash')}
                className="w-full"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'qr' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('qr')}
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                QR
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelDeliver}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDeliver} variant="default">
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
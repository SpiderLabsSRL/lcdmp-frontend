import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumberInput } from '@/components/ui/number-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Banknote, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { pickupMethodLabels } from '@/types/consts';
import { sanitizePhone, PHONE_MAX_DIGITS } from '@/utils/phone';
import type { CartItem, PaymentMethod, PickupMethod } from '@/types';
import type { ExpressOrderData } from '@/api/SalesApi';

interface ExpressOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onSubmit: (order: ExpressOrderData) => Promise<void>;
}

interface Personalization {
  notes: string;
  price: number;
}

const money = (value: number) => `Bs. ${value.toFixed(2)}`;

// Pedido de envío al momento: lo que hay en el carrito de Ventas, con fecha de hoy y hora de ahora,
// que recoge enseguida un mensajero (moto, móvil) o una persona.
export function ExpressOrderDialog({ open, onOpenChange, items, onSubmit }: ExpressOrderDialogProps) {
  const [recipientName, setRecipientName] = useState('');
  const [pickupMethod, setPickupMethod] = useState<PickupMethod | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [personalizations, setPersonalizations] = useState<Record<string, Personalization | undefined>>({});
  const [dedication, setDedication] = useState('');
  const [notes, setNotes] = useState('');
  const [chargeShipping, setChargeShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [deductStock, setDeductStock] = useState(true);
  const [deposit, setDeposit] = useState(0);
  const [depositTouched, setDepositTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);

  const itemsTotal = items.reduce((sum, item) => {
    const extra = personalizations[item.productId]?.price || 0;
    return sum + (item.price + extra) * item.quantity;
  }, 0);
  const shipping = chargeShipping ? shippingCost : 0;
  const total = itemsTotal + shipping;
  const balance = total - deposit;

  // Por defecto se cobra todo; si ya se tocó el monto, se respeta lo que puso (se acota al total)
  useEffect(() => {
    if (!depositTouched) setDeposit(total);
    else if (deposit > total) setDeposit(total);
  }, [total, depositTouched, deposit]);

  useEffect(() => {
    if (open) return;
    setRecipientName('');
    setPickupMethod(null);
    setCustomerPhone('');
    setPersonalizations({});
    setDedication('');
    setNotes('');
    setChargeShipping(false);
    setShippingCost(0);
    setDeductStock(true);
    setDeposit(0);
    setDepositTouched(false);
    setPaymentMethod('cash');
  }, [open]);

  const setPersonalization = (productId: string, value: Personalization | undefined) =>
    setPersonalizations(prev => ({ ...prev, [productId]: value }));

  const handleSubmit = async () => {
    if (submitting) return;
    if (!recipientName.trim()) {
      toast.error('Indica a nombre de quién va el pedido');
      return;
    }
    if (!pickupMethod) {
      toast.error('Indica cómo lo recoge: móvil, moto o personal');
      return;
    }
    const emptyPersonalization = items.find(item => {
      const p = personalizations[item.productId];
      return p && !p.notes.trim();
    });
    if (emptyPersonalization) {
      toast.error(`Describe la personalización de "${emptyPersonalization.name}" o desmárcala`);
      return;
    }
    if (chargeShipping && !(shippingCost > 0)) {
      toast.error('Indica el costo del envío o desmarca "Envío Pagado"');
      return;
    }
    if (deposit < 0 || deposit > total) {
      toast.error(`El pago debe estar entre 0 y ${money(total)}`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        recipientName: recipientName.trim(),
        pickupMethod,
        customerPhone: customerPhone || undefined,
        items: items.map(item => {
          const p = personalizations[item.productId];
          return {
            productId: item.productId,
            quantity: item.quantity,
            ...(p ? { customizationNotes: p.notes.trim(), customizationPrice: p.price || 0 } : {}),
          };
        }),
        deductStock,
        shippingCost: chargeShipping ? shippingCost : undefined,
        deposit,
        paymentMethod,
        dedication: dedication.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (error: any) {
      toast.error(error.message || 'Error al crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Envío al momento</DialogTitle>
          <DialogDescription>
            Pedido para hoy, con la hora de ahora, de los productos del carrito.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1">
          {/* Quién lo recoge */}
          <div className="space-y-1.5">
            <Label htmlFor="express-name" className="text-sm">A nombre de *</Label>
            <Input
              id="express-name"
              placeholder="Nombre de quien recoge o de quien pide"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Lo recoge *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(pickupMethodLabels) as PickupMethod[]).map(method => (
                <Button
                  key={method}
                  type="button"
                  variant={pickupMethod === method ? 'default' : 'outline'}
                  onClick={() => setPickupMethod(method)}
                  aria-pressed={pickupMethod === method}
                >
                  {pickupMethodLabels[method]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="express-phone" className="text-sm">Teléfono (opcional)</Label>
            <Input
              id="express-phone"
              inputMode="numeric"
              placeholder="Número de contacto"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value).slice(0, PHONE_MAX_DIGITS))}
            />
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <Label className="text-sm">Productos</Label>
            {items.map(item => {
              const personalization = personalizations[item.productId];
              return (
                <div key={item.productId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{item.quantity} × {item.name}</span>
                    <span>{money((item.price + (personalization?.price || 0)) * item.quantity)}</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!personalization}
                      aria-label={`Personalizar ${item.name}`}
                      onChange={(e) => setPersonalization(item.productId, e.target.checked ? { notes: '', price: 0 } : undefined)}
                    />
                    Personalizar
                  </label>
                  {personalization && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Qué se personaliza *</Label>
                        <Input
                          aria-label={`Personalización de ${item.name}`}
                          placeholder="Ej: nombre en la torta"
                          value={personalization.notes}
                          onChange={(e) => setPersonalization(item.productId, { ...personalization, notes: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Recargo por unidad (Bs.)</Label>
                        <NumberInput
                          aria-label={`Recargo de ${item.name}`}
                          decimal
                          fallback={0}
                          placeholder="0"
                          value={personalization.price}
                          onChange={(v) => setPersonalization(item.productId, { ...personalization, price: v })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="express-dedication" className="text-sm">Dedicatoria (opcional)</Label>
            <Input
              id="express-dedication"
              placeholder="Ej: Feliz cumpleaños, Mamá"
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="express-notes" className="text-sm">Notas (opcional)</Label>
            <Textarea
              id="express-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Envío y stock */}
          <div className="space-y-3 border rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={chargeShipping}
                onChange={(e) => setChargeShipping(e.target.checked)}
              />
              Envío Pagado
            </label>
            {chargeShipping && (
              <div className="space-y-1.5">
                <Label htmlFor="express-shipping" className="text-xs">Costo del envío (Bs.)</Label>
                <NumberInput
                  id="express-shipping"
                  decimal
                  fallback={0}
                  placeholder="0"
                  value={shippingCost}
                  onChange={setShippingCost}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={deductStock}
                onChange={(e) => setDeductStock(e.target.checked)}
              />
              Descontar de stock
            </label>
            <p className="text-xs text-muted-foreground">
              {deductStock
                ? 'Reserva las unidades en tienda ahora y se descuentan al marcar el pedido como entregado.'
                : 'No toca el stock: úsalo si el producto ya salió del inventario por otro lado.'}
            </p>
          </div>

          {/* Pago */}
          <div className="space-y-3 border rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary" data-testid="express-total">{money(total)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="express-deposit" className="text-sm">Paga ahora (Bs.)</Label>
              <NumberInput
                id="express-deposit"
                decimal
                fallback={0}
                value={deposit}
                onChange={(v) => { setDepositTouched(true); setDeposit(v); }}
              />
            </div>

            {deposit > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  aria-pressed={paymentMethod === 'cash'}
                >
                  <Banknote className="h-4 w-4 mr-2" /> Efectivo
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'qr' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('qr')}
                  aria-pressed={paymentMethod === 'qr'}
                >
                  <QrCode className="h-4 w-4 mr-2" /> QR
                </Button>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>Saldo al entregar</span>
              <span className={balance > 0 ? 'font-semibold text-orange-600' : 'font-semibold text-green-600'} data-testid="express-balance">
                {money(balance)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear pedido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExpressOrderDialog;

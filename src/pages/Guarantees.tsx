import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HandCoins, Loader2, Phone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { defaultGuaranteesApi, type IGuaranteesApi, type GuaranteeListStatus } from '@/api/GuaranteesApi';
import type { GuaranteeEntry, PaymentMethod } from '@/types';

interface GuaranteesProps {
  api?: IGuaranteesApi;
}

const money = (value: number) => `Bs. ${value.toFixed(2)}`;
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Efectivo', qr: 'QR' };

export default function Guarantees({ api = defaultGuaranteesApi }: GuaranteesProps) {
  const [status, setStatus] = useState<GuaranteeListStatus>('pending');
  const [entries, setEntries] = useState<GuaranteeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<GuaranteeEntry | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.getGuarantees(status));
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar las garantías');
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openReturn = (entry: GuaranteeEntry) => {
    setReturning(entry);
    setAmount(entry.amount);
    setMethod('cash');
  };

  const confirmReturn = async () => {
    if (!returning || submitting) return;
    if (amount < 0 || amount > returning.amount) {
      toast.error(`El monto a devolver debe estar entre 0 y ${money(returning.amount)}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.returnGuarantee(returning.orderId, { amount, method });
      toast.success(
        amount > 0
          ? `Garantía devuelta (${money(amount)}). Se registró el egreso en caja.`
          : 'Garantía cerrada sin devolución de dinero.'
      );
      setReturning(null);
      await load();
    } catch (error: any) {
      toast.error(error.message || 'Error al devolver la garantía');
      // Si ya estaba devuelta (otra pestaña/usuario), se refresca la lista
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTotal = entries.reduce((sum, e) => sum + e.amount, 0);
  const retained = returning ? returning.amount - amount : 0;

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Garantías</h1>
          <p className="text-sm sm:text-base mt-1">
            Pedidos entregados con artículos prestados (pedestales, bases) y la garantía que hay que devolver
          </p>
        </div>

        <div className="px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <Tabs value={status} onValueChange={(v) => setStatus(v as GuaranteeListStatus)}>
            <TabsList>
              <TabsTrigger value="pending">Por devolver</TabsTrigger>
              <TabsTrigger value="returned">Devueltas</TabsTrigger>
            </TabsList>
          </Tabs>
          {status === 'pending' && entries.length > 0 && (
            <p className="text-sm font-medium" data-testid="pending-total">
              {entries.length} {entries.length === 1 ? 'pedido' : 'pedidos'} · a devolver {money(pendingTotal)}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 sm:px-6">
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {status === 'pending'
                  ? 'No hay garantías pendientes de devolver.'
                  : 'Todavía no se devolvió ninguna garantía.'}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {entries.map((entry) => (
              <Card key={entry.orderId}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{entry.orderNumber} · {entry.customerName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {entry.customerPhone}
                        <span aria-hidden>·</span>
                        Entrega {format(parseISO(entry.pickupDate), 'dd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <Badge variant={entry.returnedAt ? 'secondary' : 'default'} className="shrink-0">
                      {money(entry.amount)}
                    </Badge>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Se prestó</p>
                    <p className="text-sm whitespace-pre-wrap break-words">{entry.items}</p>
                  </div>

                  {entry.returnedAt ? (
                    <p className="text-sm text-green-700">
                      Devuelta {money(entry.returnedAmount ?? 0)}
                      {entry.returnedMethod ? ` en ${METHOD_LABEL[entry.returnedMethod]}` : ''} ·{' '}
                      {format(new Date(entry.returnedAt), "dd MMM yyyy HH:mm", { locale: es })}
                      {(entry.returnedAmount ?? 0) < entry.amount &&
                        ` (se retuvo ${money(entry.amount - (entry.returnedAmount ?? 0))})`}
                    </p>
                  ) : (
                    <Button className="w-full" onClick={() => openReturn(entry)}>
                      <HandCoins className="h-4 w-4 mr-2" />
                      Devolver garantía
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!returning} onOpenChange={(open) => !open && !submitting && setReturning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver garantía</DialogTitle>
            <DialogDescription>
              {returning?.orderNumber} · {returning?.customerName}
            </DialogDescription>
          </DialogHeader>

          {returning && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Se prestó</p>
                <p className="text-sm whitespace-pre-wrap break-words">{returning.items}</p>
                <p className="text-sm font-medium mt-2">Garantía dejada: {money(returning.amount)}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guarantee-return-amount">Monto a devolver</Label>
                <NumberInput
                  id="guarantee-return-amount"
                  decimal
                  value={amount}
                  onChange={setAmount}
                  fallback={0}
                />
                <p className="text-xs text-muted-foreground">
                  Devuelve menos si algo volvió dañado o falta.
                  {retained > 0 && ` Se retiene ${money(retained)}.`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Se devuelve en</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'qr'] as PaymentMethod[]).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={method === m ? 'default' : 'outline'}
                      onClick={() => setMethod(m)}
                    >
                      {METHOD_LABEL[m]}
                    </Button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {amount > 0
                  ? `Se registrará un egreso de ${money(amount)} (${METHOD_LABEL[method]}) en la caja de hoy.`
                  : 'No se registrará ningún egreso en caja.'}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReturning(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={confirmReturn} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

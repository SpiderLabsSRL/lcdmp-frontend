import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IBakedApi } from '@/api/BakedApi';
import type { BakedItem, BakedMovement, CutResult, DoughType, WasteReason } from '@/types';

export const wasteReasonLabels: Record<WasteReason, string> = {
  expired: 'Vencida',
  burned: 'Quemada',
  accident: 'Accidente',
  other: 'Otro',
};

const reasonLabels: Record<BakedMovement['reason'], string> = {
  batch: 'Horneado registrado',
  order_baking: 'Horneado de pedido',
  order_assembly: 'Armado de pedido',
  waste: 'Merma',
  adjustment: 'Ajuste manual',
  cut: 'Corte',
};

interface ItemDialogProps {
  item: BakedItem | null;
  bakedApi: IBakedApi;
  onClose: () => void;
  onSaved: (item: BakedItem) => void;
}

// Merma / descarte: sale del inventario con un motivo.
export function WasteDialog({ item, bakedApi, onClose, onSaved }: ItemDialogProps) {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState<WasteReason>('expired');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantity(0);
    setReason('expired');
    setNotes('');
  }, [item?.id]);

  const handleSave = async () => {
    if (!item) return;
    if (!(quantity > 0)) {
      toast.error('Indica la cantidad a descartar');
      return;
    }
    if (quantity > item.quantity) {
      toast.error(`Solo hay ${item.quantity} en el inventario`);
      return;
    }
    setSaving(true);
    try {
      onSaved(await bakedApi.registerWaste(item.id, { quantity, wasteReason: reason, notes: notes.trim() || undefined }));
      toast.success('Merma registrada');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar la merma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Registrar merma</DialogTitle>
          <DialogDescription>{item?.name} · stock {item?.quantity}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="waste-quantity" className="text-sm">Cantidad a descartar *</Label>
            <NumberInput id="waste-quantity" value={quantity || undefined} fallback={0} placeholder="0" onChange={setQuantity} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Motivo *</Label>
            <Select value={reason} onValueChange={v => setReason(v as WasteReason)}>
              <SelectTrigger aria-label="Motivo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(wasteReasonLabels) as WasteReason[]).map(r => (
                  <SelectItem key={r} value={r}>{wasteReasonLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waste-notes" className="text-sm">Notas (opcional)</Label>
            <Input id="waste-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Descartar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CutDialogProps {
  item: BakedItem | null;
  bakedApi: IBakedApi;
  onClose: () => void;
  onSaved: (result: CutResult) => void;
}

// Corte: saca unidades enteras (láminas / masas grandes) y mete las piezas con sus porciones.
export function CutDialog({ item, bakedApi, onClose, onSaved }: CutDialogProps) {
  const unit = item?.unitName || 'unidad';
  const [quantity, setQuantity] = useState(1);
  const [portions, setPortions] = useState(0);
  const [pieces, setPieces] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantity(1);
    setPortions(item?.defaultPortions ?? 0);
    setPieces(0);
    setNotes('');
  }, [item?.id, item?.defaultPortions]);

  const handleSave = async () => {
    if (!item) return;
    if (!(quantity > 0)) {
      toast.error(`Indica cuántas ${unit}s se cortan`);
      return;
    }
    if (!(portions > 0)) {
      toast.error('Indica las porciones de cada pieza');
      return;
    }
    if (!(pieces > 0)) {
      toast.error('Indica cuántas piezas salieron');
      return;
    }
    setSaving(true);
    try {
      const result = await bakedApi.cutItem(item.id, { quantity, portions, pieces, notes: notes.trim() || undefined });
      if (result.shortage > 0) {
        toast.warning(`Faltaban ${result.shortage} ${unit}${result.shortage === 1 ? '' : 's'} en el inventario: el corte se registró igual`);
      } else {
        toast.success(`Corte registrado: ${pieces} piezas de ${portions} porciones`);
      }
      onSaved(result);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el corte');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Cortar {unit}s</DialogTitle>
          <DialogDescription>{item?.name} · stock {item?.quantity}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cut-quantity" className="text-sm">{unit.charAt(0).toUpperCase() + unit.slice(1)}s que se cortan *</Label>
            <NumberInput id="cut-quantity" value={quantity || undefined} fallback={0} placeholder="0" onChange={setQuantity} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cut-portions" className="text-sm">Porciones de cada pieza *</Label>
            <NumberInput id="cut-portions" value={portions || undefined} fallback={0} placeholder="Ej: 12" onChange={setPortions} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cut-pieces" className="text-sm">Piezas que salieron *</Label>
            <NumberInput id="cut-pieces" value={pieces || undefined} fallback={0} placeholder="0" onChange={setPieces} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cut-notes" className="text-sm">Notas (opcional)</Label>
            <Input id="cut-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar corte
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Ajuste manual (+/-) con nota, y stock mínimo del ítem.
export function AdjustDialog({ item, bakedApi, onClose, onSaved }: ItemDialogProps) {
  const [delta, setDelta] = useState(0);
  const [sign, setSign] = useState<'add' | 'subtract'>('add');
  const [notes, setNotes] = useState('');
  const [minStock, setMinStock] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDelta(0);
    setSign('add');
    setNotes('');
    setMinStock(item?.minStock ?? 0);
  }, [item?.id, item?.minStock]);

  const handleSave = async () => {
    if (!item) return;
    const changesStock = delta > 0;
    const changesMin = minStock !== item.minStock;
    if (!changesStock && !changesMin) {
      toast.error('No hay nada que cambiar');
      return;
    }
    if (changesStock && sign === 'subtract' && delta > item.quantity) {
      toast.error(`Solo hay ${item.quantity} en el inventario`);
      return;
    }
    setSaving(true);
    try {
      let updated = item;
      if (changesStock) {
        updated = await bakedApi.adjustStock(item.id, { delta: sign === 'add' ? delta : -delta, notes: notes.trim() || undefined });
      }
      if (changesMin) updated = await bakedApi.updateItemMinStock(item.id, minStock);
      onSaved(updated);
      toast.success('Inventario actualizado');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al ajustar el stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Ajustar inventario</DialogTitle>
          <DialogDescription>{item?.name} · stock {item?.quantity}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={sign === 'add' ? 'default' : 'outline'} onClick={() => setSign('add')} aria-pressed={sign === 'add'}>Sumar</Button>
            <Button type="button" variant={sign === 'subtract' ? 'default' : 'outline'} onClick={() => setSign('subtract')} aria-pressed={sign === 'subtract'}>Restar</Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-quantity" className="text-sm">Unidades</Label>
            <NumberInput id="adjust-quantity" value={delta || undefined} fallback={0} placeholder="0" onChange={setDelta} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-notes" className="text-sm">Motivo del ajuste</Label>
            <Input id="adjust-notes" placeholder="Ej: conteo físico" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-min" className="text-sm">Stock mínimo</Label>
            <NumberInput id="adjust-min" value={minStock} fallback={0} onChange={setMinStock} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Historial de entradas y salidas de un ítem.
export function MovementsDialog({ item, bakedApi, onClose }: Pick<ItemDialogProps, 'item' | 'bakedApi' | 'onClose'>) {
  const [movements, setMovements] = useState<BakedMovement[] | null>(null);

  useEffect(() => {
    if (!item) return;
    setMovements(null);
    bakedApi.getMovements(item.id)
      .then(setMovements)
      .catch(() => {
        toast.error('Error al cargar el historial');
        setMovements([]);
      });
  }, [item, bakedApi]);

  return (
    <Dialog open={!!item} onOpenChange={next => !next && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        {movements === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-center py-6">Sin movimientos todavía.</p>
        ) : (
          <div className="space-y-2">
            {movements.map(m => (
              <div key={m.id} className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2">
                    <Badge className={m.direction === 'in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                      {m.direction === 'in' ? 'Entrada' : 'Salida'}
                    </Badge>
                    <span className="font-semibold">{m.direction === 'in' ? '+' : '-'}{m.quantity}</span>
                  </span>
                  <span className="text-xs">{format(new Date(m.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}</span>
                </div>
                <p>
                  {reasonLabels[m.reason]}
                  {m.wasteReason && ` — ${wasteReasonLabels[m.wasteReason]}`}
                  {m.orderNumber && ` · Pedido #${m.orderNumber}`}
                </p>
                {m.shortage > 0 && <p className="text-destructive">Faltaron {m.shortage} en el inventario</p>}
                {m.notes && <p className="text-muted-foreground">{m.notes}</p>}
                {m.createdByName && <p className="text-xs text-muted-foreground">Por {m.createdByName}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DoughTypesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bakedApi: IBakedApi;
  onChanged: () => void;
}

// Administración de los tipos de masa: crear, renombrar, activar/desactivar.
export function DoughTypesDialog({ open, onOpenChange, bakedApi, onChanged }: DoughTypesDialogProps) {
  const [types, setTypes] = useState<DoughType[]>([]);
  const [name, setName] = useState('');
  const [usesPortions, setUsesPortions] = useState(true);
  const [usesShape, setUsesShape] = useState(false);
  const [usesFlavor, setUsesFlavor] = useState(true);
  const [isCuttable, setIsCuttable] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [defaultPortions, setDefaultPortions] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () =>
    bakedApi.getDoughTypes(true).then(setTypes).catch(() => toast.error('Error al cargar los tipos de masa'));

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
      onChanged();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el tipo de masa');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Indica el nombre del tipo de masa');
      return;
    }
    if (isCuttable && !unitName.trim()) {
      toast.error('Indica la unidad de la masa que se corta (lámina, masa grande...)');
      return;
    }
    await run(
      () => bakedApi.createDoughType({
        name: name.trim(),
        usesPortions: isCuttable ? true : usesPortions,
        usesShape,
        ...(usesFlavor ? {} : { usesFlavor: false }),
        ...(isCuttable ? { isCuttable: true, unitName: unitName.trim(), defaultPortions: defaultPortions > 0 ? defaultPortions : undefined } : {}),
      }),
      'Tipo de masa creado'
    );
    setName('');
    setUsesPortions(true);
    setUsesShape(false);
    setUsesFlavor(true);
    setIsCuttable(false);
    setUnitName('');
    setDefaultPortions(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tipos de masa</DialogTitle>
          <DialogDescription>Masa de torta, galleta de alfajor, masa de pie, conitos...</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {types.map(t => (
            <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-sm">{t.name}{t.isCake && <Badge variant="secondary" className="ml-2">Tortas</Badge>}</p>
                <p className="text-xs text-muted-foreground">
                  {[t.usesPortions && 'porciones', t.usesShape && 'forma'].filter(Boolean).join(' y ') || 'sin porciones ni forma'}
                  {!t.usesFlavor && ' · sin sabor'}
                  {t.isCuttable && ` · se corta (${t.unitName}${t.defaultPortions ? `, ${t.defaultPortions} porciones` : ''})`}
                  {!t.isActive && ' · desactivado'}
                </p>
              </div>
              {!t.isCake && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => bakedApi.updateDoughType(t.id, { isActive: !t.isActive }), t.isActive ? 'Tipo desactivado' : 'Tipo activado')}
                >
                  {t.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-3 space-y-3">
          <p className="font-medium text-sm">Nuevo tipo de masa</p>
          <Input aria-label="Nombre del tipo" placeholder="Ej: Galleta de alfajor" value={name} onChange={e => setName(e.target.value)} />
          <label className="flex items-center justify-between text-sm">
            Usa porciones
            <Switch checked={usesPortions} onCheckedChange={setUsesPortions} aria-label="Usa porciones" />
          </label>
          <label className="flex items-center justify-between text-sm">
            Usa sabor
            <Switch checked={usesFlavor} onCheckedChange={setUsesFlavor} aria-label="Usa sabor" />
          </label>
          <label className="flex items-center justify-between text-sm">
            Usa forma
            <Switch checked={usesShape} onCheckedChange={setUsesShape} aria-label="Usa forma" />
          </label>
          <label className="flex items-center justify-between text-sm">
            Se corta en porciones
            <Switch checked={isCuttable} onCheckedChange={setIsCuttable} aria-label="Se corta en porciones" />
          </label>
          {isCuttable && (
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Unidad" placeholder="Unidad: lámina, masa grande" value={unitName} onChange={e => setUnitName(e.target.value)} />
              <NumberInput aria-label="Porciones por defecto" placeholder="Porciones por pieza" value={defaultPortions || undefined} fallback={0} onChange={setDefaultPortions} />
            </div>
          )}
          <Button type="button" className="w-full" onClick={handleCreate} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear tipo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cakeShapes } from '@/types/consts';
import { IOrdersApi, defaultOrdersApi } from '@/api/OrdersApi';
import type { BakedItemSpec } from '@/api/BakedApi';
import type { DoughType } from '@/types';

export type BakedItemDraft = {
  doughTypeId: string;
  flavor: string;
  portions: number;
  shape: string; // '' = sin forma
  // Solo en tipos que se cortan: true = unidad entera (lámina / masa grande), false = pieza cortada
  whole: boolean;
};

export const emptyBakedItemDraft: BakedItemDraft = { doughTypeId: '', flavor: '', portions: 0, shape: '', whole: true };

// El ítem es la unidad entera de un tipo que se corta (no lleva porciones)
const isWhole = (draft: BakedItemDraft, type?: DoughType) => !!type?.isCuttable && draft.whole;

// Lo que el backend necesita para identificar el ítem, según lo que usa el tipo de masa elegido.
export function toBakedItemSpec(draft: BakedItemDraft, type?: DoughType): BakedItemSpec {
  return {
    doughTypeId: draft.doughTypeId,
    flavor: type?.usesFlavor === false ? '' : draft.flavor.trim(),
    portions: type?.usesPortions && !isWhole(draft, type) ? draft.portions : null,
    shape: type?.usesShape && draft.shape ? draft.shape : null,
  };
}

// Error de validación del borrador, o null si está completo.
export function validateBakedItemDraft(draft: BakedItemDraft, type?: DoughType): string | null {
  if (!type) return 'Elige el tipo de masa';
  if (type.usesFlavor !== false && !draft.flavor.trim()) return 'Indica el sabor';
  if (type.usesPortions && !isWhole(draft, type) && !(draft.portions > 0)) return 'Indica las porciones';
  return null;
}

interface BakedItemFieldsProps {
  doughTypes: DoughType[];
  value: BakedItemDraft;
  onChange: (value: BakedItemDraft) => void;
  ordersApi?: IOrdersApi;
  /**
   * En un tipo que se corta, deja elegir entre la unidad entera y una pieza ya cortada.
   * Solo hace falta al vincular un producto a su masa (un producto puede consumir porciones).
   * Al registrar un horneado siempre sale la unidad entera: las piezas aparecen al cortar.
   */
  allowPieces?: boolean;
}

// Tipo de masa + sabor + porciones + forma. Porciones y forma aparecen solo si el tipo las usa.
export function BakedItemFields({ doughTypes, value, onChange, ordersApi = defaultOrdersApi, allowPieces = false }: BakedItemFieldsProps) {
  const type = doughTypes.find(t => t.id === value.doughTypeId);
  const [cakeFlavors, setCakeFlavors] = useState<string[]>([]);

  // La masa de torta usa los sabores de torta del sistema: se sugieren para no escribirlos mal
  useEffect(() => {
    if (!type?.isCake) return;
    ordersApi.getFlavors()
      .then(flavors => setCakeFlavors(flavors.filter(f => f.type === 'cake').map(f => f.name)))
      .catch(() => setCakeFlavors([]));
  }, [type?.isCake, ordersApi]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Tipo de masa *</Label>
        <Select value={value.doughTypeId} onValueChange={id => onChange({ ...value, doughTypeId: id })}>
          <SelectTrigger aria-label="Tipo de masa"><SelectValue placeholder="Elige un tipo" /></SelectTrigger>
          <SelectContent>
            {doughTypes.filter(t => t.isActive).map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type?.usesFlavor !== false && (
      <div className="space-y-1.5">
        <Label htmlFor="baked-flavor" className="text-sm">Sabor *</Label>
        {type?.isCake ? (
          // La masa de torta solo admite los sabores de torta registrados
          <Select value={value.flavor} onValueChange={flavor => onChange({ ...value, flavor })}>
            <SelectTrigger id="baked-flavor" aria-label="Sabor"><SelectValue placeholder="Elige un sabor" /></SelectTrigger>
            <SelectContent>
              {cakeFlavors.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="baked-flavor"
            placeholder="Ej: Vainilla"
            value={value.flavor}
            onChange={e => onChange({ ...value, flavor: e.target.value })}
          />
        )}
      </div>
      )}

      {type?.isCuttable && allowPieces && (
        <div className="space-y-1.5">
          <Label className="text-sm">Presentación</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={value.whole ? 'default' : 'outline'} aria-pressed={value.whole} onClick={() => onChange({ ...value, whole: true })}>
              {type.unitName || 'Entera'} entera
            </Button>
            <Button type="button" variant={!value.whole ? 'default' : 'outline'} aria-pressed={!value.whole} onClick={() => onChange({ ...value, whole: false, portions: value.portions || type.defaultPortions || 0 })}>
              Pieza cortada
            </Button>
          </div>
        </div>
      )}

      {type?.usesPortions && !isWhole(value, type) && (
        <div className="space-y-1.5">
          <Label htmlFor="baked-portions" className="text-sm">Porciones *</Label>
          <NumberInput
            id="baked-portions"
            value={value.portions || undefined}
            fallback={0}
            placeholder="Ej: 20"
            onChange={portions => onChange({ ...value, portions })}
          />
        </div>
      )}

      {type?.usesShape && (
        <div className="space-y-1.5">
          <Label className="text-sm">Forma (opcional)</Label>
          <Select value={value.shape || 'none'} onValueChange={shape => onChange({ ...value, shape: shape === 'none' ? '' : shape })}>
            <SelectTrigger aria-label="Forma"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin forma</SelectItem>
              {cakeShapes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

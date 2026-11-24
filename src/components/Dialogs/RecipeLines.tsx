import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import type { BakedItem, RawMaterial } from '@/types';

export interface MaterialLine {
  rawMaterialId: string;
  quantity: number;
}

export interface DoughLine {
  bakedProductId: string;
  quantity: number;
}

// Lista editable de (materia prima, cantidad). Las cantidades van en la unidad de cada material.
export function MaterialLines({
  lines,
  rawMaterials,
  onChange,
  emptyText = 'No consume materia prima.',
}: {
  lines: MaterialLine[];
  rawMaterials: RawMaterial[];
  onChange: (lines: MaterialLine[]) => void;
  emptyText?: string;
}) {
  const unitOf = (id: string) => rawMaterials.find(m => m.id === id)?.unit;
  const patch = (index: number, change: Partial<MaterialLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...change } : line)));

  return (
    <div className="space-y-2">
      {lines.length === 0 && <p className="text-xs text-muted-foreground">{emptyText}</p>}

      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
          <Select value={line.rawMaterialId} onValueChange={v => patch(index, { rawMaterialId: v })}>
            <SelectTrigger className="text-sm" aria-label="Materia prima">
              <SelectValue placeholder="Materia prima" />
            </SelectTrigger>
            <SelectContent>
              {rawMaterials.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <NumberInput
              decimal
              min="0"
              step="any"
              value={line.quantity}
              onChange={v => patch(index, { quantity: v })}
              fallback={1}
              aria-label="Cantidad"
              className="text-sm"
            />
            <span className="text-xs text-muted-foreground w-8">{unitOf(line.rawMaterialId)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            aria-label="Quitar material"
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, { rawMaterialId: '', quantity: 1 }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Material
      </Button>
    </div>
  );
}

// Lista editable de (masa horneada, cantidad por unidad del producto).
export function DoughLines({
  lines,
  doughs,
  onChange,
}: {
  lines: DoughLine[];
  doughs: BakedItem[];
  onChange: (lines: DoughLine[]) => void;
}) {
  const patch = (index: number, change: Partial<DoughLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...change } : line)));

  return (
    <div className="space-y-2">
      {doughs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay masas en el inventario todavía. Regístralas en Hornos o en Inventario.
        </p>
      )}
      {lines.length === 0 && doughs.length > 0 && (
        <p className="text-xs text-muted-foreground">No consume masas horneadas.</p>
      )}

      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
          <Select value={line.bakedProductId} onValueChange={v => patch(index, { bakedProductId: v })}>
            <SelectTrigger className="text-sm" aria-label="Masa horneada">
              <SelectValue placeholder="Masa horneada" />
            </SelectTrigger>
            <SelectContent>
              {doughs.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NumberInput
            decimal
            min="0"
            step="any"
            value={line.quantity}
            onChange={v => patch(index, { quantity: v })}
            fallback={1}
            aria-label="Cantidad de masa"
            className="text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            aria-label="Quitar masa"
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {doughs.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lines, { bakedProductId: '', quantity: 1 }])}
        >
          <Plus className="h-4 w-4 mr-1" /> Masa
        </Button>
      )}
    </div>
  );
}

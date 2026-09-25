import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BakedProduct } from '@/types';

interface BakedProductFormProps {
  initialData?: BakedProduct;
  onClose: () => void;
  onSave: (data: any, update: boolean) => void;
}

// Definir el tipo específico para los tipos de producto
type ProductType = 'cake_base' | 'cupcake' | 'cookie' | 'bread' | 'pastry';

const productTypes: { value: ProductType; label: string }[] = [
  { value: 'cake_base', label: 'Base de torta' },
  { value: 'cupcake', label: 'Cupcakes' },
  { value: 'cookie', label: 'Galletas' },
  { value: 'bread', label: 'Pan' },
  { value: 'pastry', label: 'Pastelería' },
];

export function BakedProductForm({ initialData, onClose, onSave }: BakedProductFormProps) {
  const [formData, setFormData] = useState({
    id: initialData?.id || null,
    name: initialData?.name || '',
    type: (initialData?.type as ProductType) || 'cake_base',
    quantity: initialData?.quantity || 0,
    minStock: initialData?.minStock || 0,
    expiresAt: initialData?.expiresAt ? new Date(initialData.expiresAt).toISOString().split('T')[0] : '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined
    }, initialData ? true : false);
  };

  // Helper para actualizar el formulario con tipos seguros
  const updateFormData = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Nombre del Producto *</Label>
        <Input 
          placeholder="Nombre del producto" 
          required 
          className="text-sm"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value}))}
        />
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-sm">Tipo de Producto *</Label>
        <Select 
          value={formData.type}
          onValueChange={(value: ProductType) => setFormData(prev => ({ ...prev, type: value}))}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {productTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Cantidad</Label>
          <NumberInput
            placeholder="0"
            className="text-sm"
            value={formData.quantity}
            onChange={(v) => setFormData(prev => ({ ...prev, quantity: v}))}
            fallback={0}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Stock mínimo</Label>
          <NumberInput
            placeholder="0"
            className="text-sm"
            value={formData.minStock}
            onChange={(v) => setFormData(prev => ({ ...prev, minStock: v}))}
            fallback={0}
          />
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-sm">Fecha de expiración (opcional)</Label>
        <Input 
          type="date" 
          className="text-sm"
          value={formData.expiresAt}
          onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value}))}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1">
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
          {initialData ? 'Actualizar' : 'Registrar'}
        </Button>
      </div>
    </form>
  );
}
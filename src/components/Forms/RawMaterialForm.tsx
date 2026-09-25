import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RawMaterial, Category } from '@/types';

interface RawMaterialFormProps {
  initialData?: RawMaterial;
  categories: Category[];
  onClose: () => void;
  onSave: (data: any, update: boolean) => void;
}

const unitOptions = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidades' },
];

export function RawMaterialForm({ initialData, categories, onClose, onSave }: RawMaterialFormProps) {
  const [formData, setFormData] = useState({
    id: initialData?.id || null,
    name: initialData?.name || '',
    category: initialData?.category || '',
    unit: initialData?.unit || 'kg',
    quantity: initialData?.quantity || 0,
    minStock: initialData?.minStock || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, initialData ? true : false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Nombre *</Label>
        <Input 
          placeholder="Nombre del material" 
          required 
          className="text-sm"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Categoría *</Label>
          <Select 
            value={formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-sm">Unidad *</Label>
          <Select 
            value={formData.unit}
            onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map(unit => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Cantidad inicial</Label>
          <NumberInput
            placeholder="0"
            className="text-sm"
            value={formData.quantity}
            onChange={(v) => setFormData(prev => ({ ...prev, quantity: v }))}
            fallback={0}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Stock mínimo</Label>
          <NumberInput
            placeholder="0"
            className="text-sm"
            value={formData.minStock}
            onChange={(v) => setFormData(prev => ({ ...prev, minStock: v }))}
            fallback={0}
          />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1">
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
          {initialData ? 'Actualizar' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}
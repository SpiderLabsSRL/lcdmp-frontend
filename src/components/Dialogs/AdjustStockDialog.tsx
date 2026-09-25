import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AdjustStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  itemName: string;
  itemType: 'raw' | 'baked';
  currentStock: number;
}

export function AdjustStockDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
  currentStock
}: AdjustStockDialogProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [operation, setOperation] = useState<'add' | 'subtract' | 'set'>('add');

  const handleConfirm = () => {
    if (quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (operation === 'subtract' && quantity > currentStock) {
      toast.error(`No hay suficiente stock. Stock actual: ${currentStock}`);
      return;
    }

    const finalQuantity = operation === 'subtract' ? -quantity : quantity;
    onConfirm(finalQuantity);
    onClose();
  };

  const getActionLabel = () => {
    switch (operation) {
      case 'add': return 'Agregar';
      case 'subtract': return 'Restar';
      case 'set': return 'Establecer';
    }
  };

  const getFinalStock = () => {
    switch (operation) {
      case 'add': return Number(currentStock) + Number(quantity);
      case 'subtract': return currentStock - quantity;
      case 'set': return quantity;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Stock</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Producto</Label>
            <p className="text-sm font-medium">{itemName}</p>
            <p className="text-sm ">
              Stock actual: {currentStock} {itemType === 'raw' ? 'unidades' : 'unidades'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Operación</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={operation === 'add' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setOperation('add')}
              >
                Agregar
              </Button>
              <Button
                type="button"
                variant={operation === 'subtract' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setOperation('subtract')}
              >
                Restar
              </Button>
              <Button
                type="button"
                variant={operation === 'set' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setOperation('set')}
              >
                Establecer
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cantidad</Label>
            <NumberInput
              min={1}
              value={quantity}
              onChange={setQuantity}
              fallback={1}
              className="text-lg"
            />
          </div>

          {operation === 'set' && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm ">
                El stock se establecerá en: <span className="font-bold text-foreground">{getFinalStock()}</span>
              </p>
            </div>
          )}

          {operation === 'add' && (
            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                Nuevo stock: <span className="font-bold">{getFinalStock()}</span>
              </p>
            </div>
          )}

          {operation === 'subtract' && (
            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">
                Nuevo stock: <span className="font-bold">{getFinalStock()}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            {getActionLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
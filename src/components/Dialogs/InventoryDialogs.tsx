import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RawMaterial, Category } from '@/types';
import { RawMaterialForm } from '@/components/Forms/RawMaterialForm';

interface InventoryDialogsProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: RawMaterial | null;
  categories: Category[];
  onSaveRaw: (data: any, update: boolean) => void;
}

export function InventoryDialogs({ 
  isOpen, 
  onClose, 
  editingItem,
  categories,
  onSaveRaw
}: InventoryDialogsProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {editingItem ? 'Editar' : 'Nueva Materia Prima'}
          </DialogTitle>
        </DialogHeader>
        
        <RawMaterialForm 
          initialData={editingItem as RawMaterial}
          categories={categories}
          onClose={onClose}
          onSave={onSaveRaw}
        />
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/components/ui/responsive-table';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { 
  IInventoryApi, 
  defaultInventoryApi, 
  type RawMaterialFilters,
  type LowStockSummary
} from '@/api/InventoryApi';
import type { RawMaterial, Category } from '@/types';
import { IBakedApi, defaultBakedApi } from '@/api/BakedApi';
import { InventoryDialogs } from '@/components/Dialogs/InventoryDialogs';
import { LowStockAlert } from '@/components/Inventory/LowStockAlert';
import { FiltersSection } from '@/components/Inventory/FiltersSection';
import { MobileRawMaterialsList } from '@/components/Inventory/MobileRawMaterialsList';
import { DesktopRawMaterialsTable } from '@/components/Inventory/DesktopRawMaterialsTable';
import { BakedInventoryTab } from '@/components/Inventory/BakedInventoryTab';

interface InventoryProps {
  inventoryApi?: IInventoryApi;
  bakedApi?: IBakedApi;
}

export default function Inventory({ 
  inventoryApi = defaultInventoryApi,
  bakedApi = defaultBakedApi
}: InventoryProps) {
  const isMobile = useIsMobile();
  
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lowStockSummary, setLowStockSummary] = useState<LowStockSummary | null>(null);
  
  // Estado de UI
  const [loading, setLoading] = useState({
    raw: false,
    categories: false,
    lowStock: false
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);

  const loadRawMaterials = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, raw: true }));
      
      const filters: RawMaterialFilters = {
        category: selectedCategory,
        searchTerm: searchTerm || undefined
      };
      
      const data = await inventoryApi.getRawMaterials(filters);
      setRawMaterials(data);
    } catch (error) {
      console.error('Error loading raw materials:', error);
      toast.error('Error al cargar las materias primas');
    } finally {
      setLoading(prev => ({ ...prev, raw: false }));
    }
  }, [inventoryApi, selectedCategory, searchTerm]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, categories: true }));
      const data = await inventoryApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Error al cargar las categorías');
    } finally {
      setLoading(prev => ({ ...prev, categories: false }));
    }
  }, [inventoryApi]);

  const loadLowStockSummary = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, lowStock: true }));
      const data = await inventoryApi.getLowStockItems();
      setLowStockSummary(data);
    } catch (error) {
      console.error('Error loading low stock summary:', error);
      toast.error('Error al cargar el resumen de stock bajo');
    } finally {
      setLoading(prev => ({ ...prev, lowStock: false }));
    }
  }, [inventoryApi]);

  useEffect(() => {
    loadCategories();
    loadLowStockSummary();
  }, [loadCategories, loadLowStockSummary]);

  useEffect(() => {
    loadRawMaterials();
  }, [loadRawMaterials]);

  const handleRefresh = () => {
    loadRawMaterials();
    loadLowStockSummary();
    toast.success('Datos actualizados');
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    toast.info('Filtros restablecidos');
  };

  const handleCreateRawMaterial = async (data: any, update: boolean) => {
    try {
      if(update) {
        const updatedMaterial = await inventoryApi.updateRawMaterial(data.id, data);
        setRawMaterials(prev => prev.map(item => 
          item.id === updatedMaterial.id ? updatedMaterial : item
        ));
        toast.success('Materia prima actualizada exitosamente');
      } else {
        const newMaterial = await inventoryApi.createRawMaterial(data);
        setRawMaterials(prev => [...prev, newMaterial]);
        toast.success('Materia prima creada exitosamente');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating raw material:', error);
      toast.error('Error al crear la materia prima');
    }
  };

  const handleAdjustStock = async (id: string, quantity: number) => {
    try {
      const updated = await inventoryApi.adjustRawMaterialStock(id, quantity);
      setRawMaterials(prev => prev.map(m => m.id === id ? updated : m));
      toast.success('Stock ajustado exitosamente');
      loadLowStockSummary();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error('Error al ajustar el stock');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <InventoryHeader 
          onRefresh={handleRefresh}
          onAddRaw={() => {
            setEditingItem(null);
            setIsDialogOpen(true);
          }}
        />

        {/* Low Stock Alert */}
        {lowStockSummary && lowStockSummary.totalLowStock > 0 && (
          <LowStockAlert summary={lowStockSummary} />
        )}

        {/* Main Content */}
        <Tabs defaultValue="raw" className="px-4 sm:px-0">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="raw">Materias Primas</TabsTrigger>
            <TabsTrigger value="baked">Productos Horneados</TabsTrigger>
          </TabsList>

          {/* Raw Materials Tab */}
          <TabsContent value="raw" className="space-y-4 mt-4">
            <FiltersSection
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={categories}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters(!showFilters)}
              onResetFilters={handleResetFilters}
              isLoading={loading.raw}
            />

            {isMobile ? (
              <MobileRawMaterialsList
                materials={rawMaterials}
                loading={loading.raw}
                onEdit={(material) => {
                  setEditingItem(material);
                  setIsDialogOpen(true);
                }}
                onAdjustStock={handleAdjustStock}
              />
            ) : (
              <DesktopRawMaterialsTable
                materials={rawMaterials}
                loading={loading.raw}
                onEdit={(material) => {
                  setEditingItem(material);
                  setIsDialogOpen(true);
                }}
                onAdjustStock={handleAdjustStock}
              />
            )}
          </TabsContent>

          {/* Baked Products Tab */}
          <TabsContent value="baked" className="space-y-4 mt-4">
            <BakedInventoryTab bakedApi={bakedApi} onChanged={loadLowStockSummary} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <InventoryDialogs
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingItem(null);
          }}
          editingItem={editingItem}
          categories={categories}
          onSaveRaw={handleCreateRawMaterial}
        />
      </div>
    </MainLayout>
  );
}

function InventoryHeader({ 
  onRefresh, 
  onAddRaw 
}: { 
  onRefresh: () => void;
  onAddRaw: () => void;
}) {
  return (
    <div className="px-4 sm:px-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
          Inventario
        </h1>
        <p className="text-sm sm:text-base ">
          Control de materias primas y productos horneados
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          size="icon"
          onClick={onRefresh}
          className="sm:w-10 h-10"
          title="Actualizar datos"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={onAddRaw}
          className="w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Materia Prima
        </Button>
      </div>
    </div>
  );
}

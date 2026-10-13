import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/components/ui/responsive-table';
import { Plus, Search, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { 
  IInventoryApi, 
  defaultInventoryApi, 
  type RawMaterialFilters,
  type BakedProductFilters,
  type LowStockSummary
} from '@/api/InventoryApi';
import type { RawMaterial, BakedProduct, Category } from '@/types';
import { InventoryDialogs } from '@/components/Dialogs/InventoryDialogs';
import { LowStockAlert } from '@/components/Inventory/LowStockAlert';
import { FiltersSection } from '@/components/Inventory/FiltersSection';
import { MobileRawMaterialsList } from '@/components/Inventory/MobileRawMaterialsList';
import { DesktopRawMaterialsTable } from '@/components/Inventory/DesktopRawMaterialsTable';
import { MobileBakedProductsGrid } from '@/components/Inventory/MobileBakedProductsGrid';

interface InventoryProps {
  inventoryApi?: IInventoryApi;
}

export default function Inventory({ 
  inventoryApi = defaultInventoryApi 
}: InventoryProps) {
  const isMobile = useIsMobile();
  
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [bakedProducts, setBakedProducts] = useState<BakedProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lowStockSummary, setLowStockSummary] = useState<LowStockSummary | null>(null);
  
  // Estado de UI
  const [loading, setLoading] = useState({
    raw: false,
    baked: false,
    categories: false,
    lowStock: false
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'raw' | 'baked'>('raw');
  const [showFilters, setShowFilters] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | BakedProduct | null>(null);

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

  const loadBakedProducts = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, baked: true }));
      
      const filters: BakedProductFilters = {
        searchTerm: searchTerm || undefined
      };
      
      const data = await inventoryApi.getBakedProducts(filters);
      setBakedProducts(data);
    } catch (error) {
      console.error('Error loading baked products:', error);
      toast.error('Error al cargar los productos horneados');
    } finally {
      setLoading(prev => ({ ...prev, baked: false }));
    }
  }, [inventoryApi, searchTerm]);

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

  useEffect(() => {
    loadBakedProducts();
  }, [loadBakedProducts]);

  const handleRefresh = () => {
    loadRawMaterials();
    loadBakedProducts();
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

  const handleCreateBakedProduct = async (data: any, update: boolean) => {
    try {
      if(update) {
        const updatedMaterial = await inventoryApi.updateBakedProduct(data.id, data);
        setBakedProducts(prev => prev.map(item => 
          item.id === updatedMaterial.id ? updatedMaterial : item
        ));
        toast.success('Producto horneado actualizado exitosamente');
      } else {
        const newProduct = await inventoryApi.createBakedProduct(data);
        setBakedProducts(prev => [...prev, newProduct]);
        toast.success('Producto horneado creado exitosamente');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating baked product:', error);
      toast.error('Error al crear el producto horneado');
    }
  };

  const handleAdjustStock = async (id: string, type: 'raw' | 'baked', quantity: number) => {
    try {
      if (type === 'raw') {
        const updated = await inventoryApi.adjustRawMaterialStock(id, quantity);
        setRawMaterials(prev => prev.map(m => m.id === id ? updated : m));
        toast.success('Stock ajustado exitosamente');
      } else {
        const updated = await inventoryApi.adjustBakedProductStock(id, quantity);
        setBakedProducts(prev => prev.map(p => p.id === id ? updated : p));
        toast.success('Stock ajustado exitosamente');
      }
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
            setDialogType('raw');
            setEditingItem(null);
            setIsDialogOpen(true);
          }}
          onAddBaked={() => {
            setDialogType('baked');
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
                  setDialogType('raw');
                  setIsDialogOpen(true);
                }}
                onAdjustStock={(id, quantity) => handleAdjustStock(id, 'raw', quantity)}
              />
            ) : (
              <DesktopRawMaterialsTable
                materials={rawMaterials}
                loading={loading.raw}
                onEdit={(material) => {
                  setEditingItem(material);
                  setDialogType('raw');
                  setIsDialogOpen(true);
                }}
                onAdjustStock={(id, quantity) => handleAdjustStock(id, 'raw', quantity)}
              />
            )}
          </TabsContent>

          {/* Baked Products Tab */}
          <TabsContent value="baked" className="space-y-4 mt-4">
            <div className="px-4 sm:px-0">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " />
                      <Input 
                        placeholder="Buscar productos horneados..." 
                        className="pl-10 w-full text-sm sm:text-base"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="sm:w-10 h-10 shrink-0"
                      onClick={handleResetFilters}
                      title="Restablecer filtros"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <MobileBakedProductsGrid
              products={bakedProducts}
              loading={loading.baked}
              onEdit={(product) => {
                setEditingItem(product);
                setDialogType('baked');
                setIsDialogOpen(true);
              }}
              onAdjustStock={(id, quantity) => handleAdjustStock(id, 'baked', quantity)}
            />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <InventoryDialogs
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingItem(null);
          }}
          dialogType={dialogType}
          editingItem={editingItem}
          categories={categories}
          onSaveRaw={handleCreateRawMaterial}
          onSaveBaked={handleCreateBakedProduct}
        />
      </div>
    </MainLayout>
  );
}

function InventoryHeader({ 
  onRefresh, 
  onAddRaw, 
  onAddBaked 
}: { 
  onRefresh: () => void;
  onAddRaw: () => void;
  onAddBaked: () => void;
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
          variant="outline" 
          onClick={onAddBaked}
          className="w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Registrar Horneado
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

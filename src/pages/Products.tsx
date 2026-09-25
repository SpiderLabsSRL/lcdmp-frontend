// src/pages/Products.tsx (versión modificada)
import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MobileCard, MobileCardHeader, MobileCardRow, useIsMobile } from '@/components/ui/responsive-table';
import { Plus, Search, Edit2, Trash2, Cake, Package, Filter, X, PlusCircle, Loader2, Gift, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Flavor, Product, CreateProductData, EditProductData, AddStockData, CreateFlavorData, EditFlavorData, SweetTableCombo, CreateSweetTableComboData, EditSweetTableComboData, ComboProduct } from '@/types';
import { categories } from '@/types/consts';
import { IProductsApi, defaultProductsApi } from '@/api/ProductsApi';

interface ProductsProps {
  api?: IProductsApi;
}

export default function Products({ api = defaultProductsApi }: ProductsProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isFlavorDialogOpen, setIsFlavorDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado para sabores
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [editingFlavor, setEditingFlavor] = useState<Flavor | null>(null);
  const [deletingFlavor, setDeletingFlavor] = useState<Flavor | null>(null);
  const [isFlavorDeleteDialogOpen, setIsFlavorDeleteDialogOpen] = useState(false);
  const [loadingFlavors, setLoadingFlavors] = useState(true);

  // Estado para mesas dulces predefinidas
  const [combos, setCombos] = useState<SweetTableCombo[]>([]);
  const [isComboDialogOpen, setIsComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<SweetTableCombo | null>(null);
  const [deletingCombo, setDeletingCombo] = useState<SweetTableCombo | null>(null);
  const [isComboDeleteDialogOpen, setIsComboDeleteDialogOpen] = useState(false);
  const [loadingCombos, setLoadingCombos] = useState(true);

  // Cargar datos iniciales
  useEffect(() => {
    loadProducts();
    loadFlavors();
    loadCombos();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts(searchTerm);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const loadFlavors = async () => {
    try {
      setLoadingFlavors(true);
      const data = await api.getFlavors();
      setFlavors(data);
    } catch (error) {
      console.error('Error loading flavors:', error);
      toast.error('Error al cargar los sabores');
    } finally {
      setLoadingFlavors(false);
    }
  };

  const loadCombos = async () => {
    try {
      setLoadingCombos(true);
      const data = await api.getSweetTableCombos();
      setCombos(data);
    } catch (error) {
      console.error('Error loading sweet table combos:', error);
      toast.error('Error al cargar las mesas dulces');
    } finally {
      setLoadingCombos(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    toast.info('Filtros restablecidos');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setIsProductDialogOpen(true);
  }

  const handleDeleteProduct = (product: Product) => {
    setDeletingProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deletingProduct) return;

    setSubmitting(true);
    try {
      await api.deleteProduct(deletingProduct.id);
      await loadProducts(); // Recargar la lista
      setIsDeleteDialogOpen(false);
      toast.success(`Producto "${deletingProduct.name}" eliminado exitosamente`);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    } finally {
      setSubmitting(false);
      setDeletingProduct(null);
    }
  }

  const handleCancelDeleteProduct = () => {
    setDeletingProduct(null);
    setIsDeleteDialogOpen(false);
  }

  const handleAddStock = (product: Product) => {
    setStockProduct(product);
  };

  const handleCloseProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
  };

  const handleCloseStockDialog = () => {
    setStockProduct(null);
  };

  const handleProductSaved = async (savedProduct: Product) => {
    try {
      if (editingProduct) {
        // Editar producto existente
        const editData: EditProductData = {
          id: savedProduct.id,
          name: savedProduct.name,
          description: savedProduct.description,
          category: savedProduct.category,
          location: savedProduct.location,
          basePrice: savedProduct.basePrice,
          pricePerPortion: Number(savedProduct.pricePerPortion),
          stock: savedProduct.stock,
          minStock: savedProduct.minStock,
          restockQuantity: savedProduct.restockQuantity,
          isActive: savedProduct.isActive,
        };
        await api.editProduct(editData);
        toast.success(`Producto "${savedProduct.name}" actualizado exitosamente`);
      } else {
        // Crear nuevo producto
        const createData: CreateProductData = {
          name: savedProduct.name,
          description: savedProduct.description,
          category: savedProduct.category,
          location: savedProduct.location,
          basePrice: savedProduct.basePrice,
          pricePerPortion: savedProduct.pricePerPortion,
          stock: savedProduct.stock,
          minStock: savedProduct.minStock,
          restockQuantity: savedProduct.restockQuantity,
          isActive: savedProduct.isActive,
        };
        await api.createProduct(createData);
        toast.success(`Producto "${savedProduct.name}" creado exitosamente`);
      }
      await loadProducts(); // Recargar la lista
      handleCloseProductDialog();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    }
  };

  const handleStockAdded = async (productId: string, quantity: number) => {
    try {
      const stockData: AddStockData = { productId, quantity };
      await api.addProductStock(stockData);
      await loadProducts(); // Recargar la lista
      handleCloseStockDialog();
      toast.success(`Se agregaron ${quantity} unidades al stock`);
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error('Error al agregar stock');
    }
  };

  const handleAddFlavor = async (newFlavor: Omit<Flavor, 'id'>) => {
    try {
      const createData: CreateFlavorData = {
        name: newFlavor.name,
        type: newFlavor.type,
        isActive: newFlavor.isActive,
      };
      await api.createFlavor(createData);
      await loadFlavors(); // Recargar la lista
      toast.success(`Sabor "${newFlavor.name}" creado exitosamente`);
    } catch (error) {
      console.error('Error creating flavor:', error);
      toast.error('Error al crear el sabor');
    }
  };

  const handleToggleFlavorStatus = async (flavorId: string, currentStatus: boolean) => {
    try {
      const updatedFlavor = await api.toggleFlavorStatus(flavorId, !currentStatus);
      setFlavors(flavors.map(flavor => 
        flavor.id === flavorId ? updatedFlavor : flavor
      ));
      toast.success(`Sabor "${updatedFlavor.name}" ${updatedFlavor.isActive ? 'activado' : 'desactivado'} exitosamente`);
    } catch (error) {
      console.error('Error toggling flavor status:', error);
      toast.error('Error al cambiar el estado del sabor');
    }
  };

  const handleDeleteFlavor = (flavor: Flavor) => {
    setDeletingFlavor(flavor);
    setIsFlavorDeleteDialogOpen(true);
  };

  const handleConfirmDeleteFlavor = async () => {
    if (!deletingFlavor) return;
    
    try {
      await api.deleteFlavor(deletingFlavor.id);
      await loadFlavors(); // Recargar la lista
      setIsFlavorDeleteDialogOpen(false);
      toast.success(`Sabor "${deletingFlavor.name}" eliminado exitosamente`);
      setDeletingFlavor(null);
    } catch (error) {
      console.error('Error deleting flavor:', error);
      toast.error('Error al eliminar el sabor');
    }
  };

  const handleCancelDeleteFlavor = () => {
    setDeletingFlavor(null);
    setIsFlavorDeleteDialogOpen(false);
  };

  const handleEditFlavor = (flavor: Flavor) => {
    setEditingFlavor(flavor);
    setIsFlavorDialogOpen(true);
  };

  const handleUpdateFlavor = async (updatedFlavor: Flavor) => {
    try {
      const editData: EditFlavorData = {
        id: updatedFlavor.id,
        name: updatedFlavor.name,
        type: updatedFlavor.type,
        isActive: updatedFlavor.isActive,
      };
      await api.editFlavor(editData);
      await loadFlavors(); // Recargar la lista
      toast.success(`Sabor "${updatedFlavor.name}" actualizado exitosamente`);
      setEditingFlavor(null);
    } catch (error) {
      console.error('Error updating flavor:', error);
      toast.error('Error al actualizar el sabor');
    }
  };

  const handleCreateCombo = () => {
    setEditingCombo(null);
    setIsComboDialogOpen(true);
  };

  const handleEditCombo = (combo: SweetTableCombo) => {
    setEditingCombo(combo);
    setIsComboDialogOpen(true);
  };

  const handleCloseComboDialog = () => {
    setIsComboDialogOpen(false);
    setEditingCombo(null);
  };

  const handleSaveCombo = async (data: CreateSweetTableComboData) => {
    try {
      if (editingCombo) {
        const editData: EditSweetTableComboData = { id: editingCombo.id, ...data };
        await api.editSweetTableCombo(editData);
        toast.success(`Mesa dulce "${data.name}" actualizada exitosamente`);
      } else {
        await api.createSweetTableCombo(data);
        toast.success(`Mesa dulce "${data.name}" creada exitosamente`);
      }
      await loadCombos();
      handleCloseComboDialog();
    } catch (error) {
      console.error('Error saving sweet table combo:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar la mesa dulce');
    }
  };

  const handleToggleComboStatus = async (combo: SweetTableCombo) => {
    try {
      const updatedCombo = await api.toggleSweetTableComboStatus(combo.id, !combo.isActive);
      setCombos(combos.map(c => c.id === combo.id ? updatedCombo : c));
      toast.success(`Mesa dulce "${updatedCombo.name}" ${updatedCombo.isActive ? 'activada' : 'desactivada'} exitosamente`);
    } catch (error) {
      console.error('Error toggling combo status:', error);
      toast.error('Error al cambiar el estado de la mesa dulce');
    }
  };

  const handleDeleteCombo = (combo: SweetTableCombo) => {
    setDeletingCombo(combo);
    setIsComboDeleteDialogOpen(true);
  };

  const handleConfirmDeleteCombo = async () => {
    if (!deletingCombo) return;

    setSubmitting(true);
    try {
      await api.deleteSweetTableCombo(deletingCombo.id);
      await loadCombos();
      setIsComboDeleteDialogOpen(false);
      toast.success(`Mesa dulce "${deletingCombo.name}" eliminada exitosamente`);
    } catch (error) {
      console.error('Error deleting sweet table combo:', error);
      toast.error('Error al eliminar la mesa dulce');
    } finally {
      setSubmitting(false);
      setDeletingCombo(null);
    }
  };

  const handleCancelDeleteCombo = () => {
    setDeletingCombo(null);
    setIsComboDeleteDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Productos
            </h1>
            <p className="text-sm sm:text-base ">
              Catálogo de productos y sabores
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {activeTab === 'flavors' && (
              <Dialog open={isFlavorDialogOpen} onOpenChange={(open) => {
                if (!open) setEditingFlavor(null);
                setIsFlavorDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto justify-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Sabor
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                      {editingFlavor ? 'Editar Sabor' : 'Nuevo Sabor'}
                    </DialogTitle>
                  </DialogHeader>
                  <FlavorForm
                    onClose={() => {
                      setIsFlavorDialogOpen(false);
                      setEditingFlavor(null);
                    }}
                    onSave={editingFlavor ? handleUpdateFlavor : handleAddFlavor}
                    initialFlavor={editingFlavor}
                  />
                </DialogContent>
              </Dialog>
            )}

            {activeTab === 'products' && (
              <>
                <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                  if (!open) handleCloseProductDialog();
                  setIsProductDialogOpen(open);
                }}>
                  <DialogContent className="w-[95vw] sm:w-full max-w-lg rounded-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">
                        {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                      </DialogTitle>
                    </DialogHeader>
                    <ProductForm
                      onClose={handleCloseProductDialog}
                      onSave={handleProductSaved}
                      initialProduct={editingProduct}
                    />
                  </DialogContent>
                </Dialog>

                <Button
                  className="w-full sm:w-auto justify-center"
                  onClick={handleCreateProduct}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </>
            )}

            {activeTab === 'combos' && (
              <Button
                className="w-full sm:w-auto justify-center"
                onClick={handleCreateCombo}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Mesa Dulce
              </Button>
            )}
          </div>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar producto</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              {deletingProduct && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <p className="font-medium">{deletingProduct.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleCancelDeleteProduct}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleConfirmDeleteProduct}
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Producto
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isFlavorDeleteDialogOpen} onOpenChange={setIsFlavorDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar sabor</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar este sabor? Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              {deletingFlavor && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">{deletingFlavor.name}</p>
                    <p className="text-sm ">
                      Tipo: {deletingFlavor.type === 'cake' ? 'Sabor de torta' : 'Sabor de relleno'}
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={handleCancelDeleteFlavor}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleConfirmDeleteFlavor}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Sabor
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isComboDialogOpen} onOpenChange={(open) => {
            if (!open) handleCloseComboDialog();
            setIsComboDialogOpen(open);
          }}>
            <DialogContent className="w-[95vw] sm:w-full max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingCombo ? 'Editar Mesa Dulce' : 'Nueva Mesa Dulce'}
                </DialogTitle>
              </DialogHeader>
              <ComboForm
                onClose={handleCloseComboDialog}
                onSave={handleSaveCombo}
                initialCombo={editingCombo}
                catalogProducts={products}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isComboDeleteDialogOpen} onOpenChange={setIsComboDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar mesa dulce</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar esta mesa dulce? Esta acción no se puede deshacer. Los pedidos ya creados con esta mesa no se ven afectados.
                </DialogDescription>
              </DialogHeader>
              {deletingCombo && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">{deletingCombo.name}</p>
                    <p className="text-sm ">
                      {deletingCombo.totalQuantity} postres · Bs. {deletingCombo.fixedPrice ?? deletingCombo.price}
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={handleCancelDeleteCombo} disabled={submitting}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleConfirmDeleteCombo} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Mesa Dulce
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Stock Dialog */}
        <Dialog open={stockProduct !== null} onOpenChange={handleCloseStockDialog}>
          <DialogContent className="w-[95vw] sm:w-full max-w-md rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Agregar Stock - {stockProduct?.name}
              </DialogTitle>
            </DialogHeader>
            {stockProduct && (
              <AddStockForm 
                product={stockProduct} 
                onClose={handleCloseStockDialog}
                onAddStock={handleStockAdded}
              />
            )}
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-0">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="flavors">Sabores</TabsTrigger>
            <TabsTrigger value="combos">Mesa Dulce</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 mt-4">
            {/* Filters - Mobile first */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                {/* Mobile filter toggle */}
                <div className="flex sm:hidden items-center justify-between mb-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                  </Button>
                </div>

                <div className={`${showFilters ? 'block' : 'hidden'} sm:block space-y-3`}>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " />
                      <Input 
                        placeholder="Buscar productos..." 
                        className="pl-10 w-full text-sm sm:text-base"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key='all' value='all'>Todos</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="sm:w-10 h-10 shrink-0"
                      onClick={resetFilters}
                      title="Restablecer filtros"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {(searchTerm || selectedCategory !== 'all') && (
                    <div className="flex items-center gap-2 text-xs  flex-wrap">
                      <span>Filtros activos:</span>
                      {searchTerm && (
                        <Badge variant="secondary" className="text-xs">
                          Búsqueda: "{searchTerm}"
                        </Badge>
                      )}
                      {selectedCategory !== 'all' && (
                        <Badge variant="secondary" className="text-xs">
                          Categoría: {categories.find(c => c.value === selectedCategory)?.label}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!loading && products.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center ">
                  No se encontraron productos
                </CardContent>
              </Card>
            )}
    
            {!loading && products.length > 0 && (
              isMobile ? (
                <div className="space-y-3">
                  {filteredProducts.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="">No se encontraron productos</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredProducts.map(product => (
                      <MobileCard key={product.id} className="active:scale-[0.98] transition-transform">
                        <MobileCardHeader className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                              <Cake className="h-5 w-5 " />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-xs  truncate">{product.description}</p>
                            </div>
                          </div>
                        </MobileCardHeader>
                        
                        <div className="px-3 pb-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs ">Categoría</p>
                              <Badge variant="outline" className="text-xs">
                                {categories.find(c => c.value === product.category)?.label}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs ">Precio</p>
                              <p className="font-medium">Bs. {product.basePrice}</p>
                            </div>
                            <div>
                              <p className="text-xs ">Stock</p>
                              <p className={product.stock <= product.minStock ? 'text-destructive font-medium' : ''}>
                                {product.stock} / {product.minStock}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs ">Ubicación</p>
                              <Badge variant={product.location === 'store' ? 'default' : 'secondary'} className="text-xs">
                                {product.location === 'store' ? 'Tienda' : 'Producción'}
                              </Badge>
                            </div>
                          </div>
  
                          <div className="flex items-center justify-between pt-2 border-t">
                            <Badge variant={product.isActive ? 'default' : 'secondary'}>
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleAddStock(product)}
                              >
                                <PlusCircle className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDeleteProduct(product)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </MobileCard>
                    ))
                  )}
                </div>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Producto</TableHead>
                          <TableHead className="whitespace-nowrap">Categoría</TableHead>
                          <TableHead className="whitespace-nowrap">Precio Base</TableHead>
                          <TableHead className="whitespace-nowrap">Ubicación</TableHead>
                          <TableHead className="whitespace-nowrap">Stock</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 ">
                              No se encontraron productos
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map(product => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="flex items-center gap-3 min-w-[200px]">
                                  <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                                    <Cake className="h-5 w-5 " />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{product.name}</p>
                                    <p className="text-sm  truncate max-w-xs">
                                      {product.description}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {categories.find(c => c.value === product.category)?.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">Bs. {product.basePrice}</TableCell>
                              <TableCell>
                                <Badge variant={product.location === 'store' ? 'default' : 'secondary'} className="whitespace-nowrap">
                                  {product.location === 'store' ? 'Tienda' : 'Producción'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className={product.stock <= product.minStock ? 'text-destructive font-medium' : ''}>
                                  {product.stock}
                                </span>
                                <span className=""> / {product.minStock}</span>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleAddStock(product)}
                                  title="Agregar stock"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleEditProduct(product)}
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteProduct(product)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )
            )}
          </TabsContent>

          <TabsContent value="flavors" className="space-y-4 mt-4">
            {loadingFlavors ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-0">
                {/* Cake Flavors */}
                <Card>
                  <CardHeader className="px-4 py-3 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Cake className="h-4 w-4 sm:h-5 sm:w-5" />
                      Sabores de Torta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-6">
                    <div className="space-y-2">
                      {flavors.filter(f => f.type === 'cake').map(flavor => (
                        <div key={flavor.id} className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
                          <span className={`text-sm sm:text-base font-medium ${!flavor.isActive ? ' line-through' : ''}`}>
                            {flavor.name}
                          </span>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Switch 
                              checked={flavor.isActive} 
                              onCheckedChange={() => handleToggleFlavorStatus(flavor.id, flavor.isActive)}
                              className="scale-75 sm:scale-100" 
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleEditFlavor(flavor)}
                            >
                              <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleDeleteFlavor(flavor)}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {flavors.filter(f => f.type === 'cake').length === 0 && (
                        <div className="text-center py-4  text-sm">
                          No hay sabores de torta registrados
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Filling Flavors */}
                <Card>
                  <CardHeader className="px-4 py-3 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                      Sabores de Relleno
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-6">
                    <div className="space-y-2">
                      {flavors.filter(f => f.type === 'filling').map(flavor => (
                        <div key={flavor.id} className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
                          <span className={`text-sm sm:text-base font-medium ${!flavor.isActive ? ' line-through' : ''}`}>
                            {flavor.name}
                          </span>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Switch 
                              checked={flavor.isActive} 
                              onCheckedChange={() => handleToggleFlavorStatus(flavor.id, flavor.isActive)}
                              className="scale-75 sm:scale-100" 
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleEditFlavor(flavor)}
                            >
                              <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleDeleteFlavor(flavor)}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {flavors.filter(f => f.type === 'filling').length === 0 && (
                        <div className="text-center py-4  text-sm">
                          No hay sabores de relleno registrados
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="combos" className="space-y-4 mt-4">
            {loadingCombos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : combos.length === 0 ? (
              <Card className="mx-4 sm:mx-0">
                <CardContent className="p-8 text-center space-y-3">
                  <Gift className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="">No hay mesas dulces configuradas todavía</p>
                  <Button onClick={handleCreateCombo}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear la primera mesa dulce
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-0">
                {combos.map(combo => (
                  <Card key={combo.id} className={`transition-opacity ${!combo.isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-base truncate">{combo.name}</p>
                            {!combo.isActive && (
                              <Badge variant="secondary" className="text-xs">Inactiva</Badge>
                            )}
                          </div>
                          <p className="text-sm  mt-0.5">{combo.totalQuantity} postres</p>
                        </div>
                        <Switch
                          checked={combo.isActive}
                          onCheckedChange={() => handleToggleComboStatus(combo)}
                        />
                      </div>

                      <p className="text-2xl font-bold text-primary">Bs. {combo.fixedPrice ?? combo.price}</p>

                      <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                        {combo.products.map((p, i) => (
                          <p key={i} className="text-sm truncate">
                            {p.quantity} × {p.productName || p.product?.name}
                          </p>
                        ))}
                      </div>

                      <div className="flex justify-end gap-1 pt-1 border-t">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditCombo(combo)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteCombo(combo)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Los componentes AddStockForm, ProductForm y FlavorForm se mantienen igual
// (incluir los mismos componentes que estaban en el archivo original)
function AddStockForm({ product, onClose, onAddStock }: { 
  product: Product; 
  onClose: () => void;
  onAddStock: (productId: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    setSubmitting(true);
    try {
      await onAddStock(product.id, quantity);
      toast.success(`Se agregaron ${quantity} unidades al stock de "${product.name}"`);
      onClose();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error('Error al agregar stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Stock actual</Label>
        <p className="text-lg font-semibold">{product.stock} unidades</p>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Cantidad a agregar *</Label>
        <NumberInput
          min="1"
          value={quantity}
          onChange={setQuantity}
          fallback={1}
          placeholder="Cantidad"
          required
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Stock después de agregar</Label>
        <p className="text-lg font-semibold text-primary">{product.stock + quantity} unidades</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1" disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Agregar Stock
        </Button>
      </div>
    </form>
  );
}

function ProductForm({ onClose, onSave, initialProduct }: { 
  onClose: () => void; 
  onSave: (product: Product) => void;
  initialProduct?: Product | null;
}) {
  const isEditing = !!initialProduct;
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: initialProduct?.name || '',
    description: initialProduct?.description || '',
    category: initialProduct?.category || 'cake',
    location: initialProduct?.location || 'store',
    basePrice: initialProduct?.basePrice || 0,
    pricePerPortion: initialProduct?.pricePerPortion || 0,
    stock: initialProduct?.stock || 0,
    minStock: initialProduct?.minStock || 1,
    restockQuantity: initialProduct?.restockQuantity ?? undefined,
    isActive: initialProduct?.isActive ?? true,
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!formData.name.trim()) {
      toast.error('El nombre del producto es requerido');
      setSubmitting(false);
      return;
    }
    
    if (formData.basePrice <= 0) {
      toast.error('El precio base debe ser mayor a 0');
      setSubmitting(false);
      return;
    }

    const product: Product = {
      id: initialProduct?.id || Date.now().toString(),
      name: formData.name,
      description: formData.description,
      basePrice: formData.basePrice,
      category: formData.category as any,
      portionSize: 10,
      pricePerPortion: formData.pricePerPortion,
      isActive: formData.isActive,
      location: formData.location as any,
      stock: formData.stock,
      minStock: formData.minStock,
      restockQuantity: formData.restockQuantity || null,
    };
    
    await onSave(product);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Nombre *</Label>
        <Input 
          placeholder="Nombre del producto" 
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required 
          className="text-sm" 
        />
      </div>
      
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Descripción</Label>
        <Textarea 
          placeholder="Descripción del producto" 
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="text-sm" 
          rows={3} 
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Categoría *</Label>
          <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Ubicación</Label>
          <Select value={formData.location} onValueChange={(v) => handleChange('location', v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="store">Tienda</SelectItem>
              <SelectItem value="production">Producción</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Precio base (Bs.)</Label>
          <NumberInput
            placeholder="0"
            value={formData.basePrice}
            onChange={(v) => handleChange('basePrice', v)}
            decimal
            fallback={0}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Precio por porción (Bs.)</Label>
          <NumberInput
            placeholder="0"
            value={formData.pricePerPortion}
            onChange={(v) => handleChange('pricePerPortion', v)}
            decimal
            fallback={0}
            className="text-sm"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Stock inicial</Label>
          <NumberInput
            placeholder="0"
            value={formData.stock}
            onChange={(v) => handleChange('stock', v)}
            fallback={0}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Stock mínimo</Label>
          <NumberInput
            placeholder="0"
            value={formData.minStock}
            onChange={(v) => handleChange('minStock', v)}
            fallback={0}
            className="text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Cantidad de reposición automática (opcional)</Label>
        <NumberInput
          placeholder="Sin reposición automática"
          value={formData.restockQuantity}
          onChange={(v) => handleChange('restockQuantity', v)}
          fallback={0}
          className="text-sm"
        />
        <p className="text-xs ">
          Cuando el stock llegue al mínimo, se creará automáticamente una tarea en Hornos para producir esta cantidad. Déjalo vacío para no reponer automáticamente.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="active"
          checked={formData.isActive}
          onCheckedChange={(v) => handleChange('isActive', v)}
          className="scale-75 sm:scale-100" 
        />
        <Label htmlFor="active" className="text-sm">Producto activo</Label>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1" disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? 'Actualizar Producto' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
}

function FlavorForm({ onClose, onSave, initialFlavor }: { 
  onClose: () => void; 
  onSave: (flavor: Flavor) => void;
  initialFlavor?: Flavor | null;
}) {
  const isEditing = !!initialFlavor;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(initialFlavor?.name || '');
  const [type, setType] = useState<'cake' | 'filling'>(initialFlavor?.type || 'cake');
  const [isActive, setIsActive] = useState(initialFlavor?.isActive ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!name.trim()) {
      toast.error('El nombre del sabor es requerido');
      setSubmitting(false);
      return;
    }

    const flavorData = {
      name: name.trim(),
      type,
      isActive,
    };

    if (isEditing && initialFlavor) {
      await onSave({ ...flavorData, id: initialFlavor.id });
    } else {
      await onSave(flavorData as any);
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Nombre del sabor *</Label>
        <Input 
          placeholder="Ej: Chocolate belga" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required 
          className="text-sm" 
        />
      </div>
      
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Tipo *</Label>
        <Select value={type} onValueChange={(v) => setType(v as 'cake' | 'filling')}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cake">Sabor de torta</SelectItem>
            <SelectItem value="filling">Sabor de relleno</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch 
          id="flavor-active" 
          checked={isActive}
          onCheckedChange={setIsActive}
          className="scale-75 sm:scale-100" 
        />
        <Label htmlFor="flavor-active" className="text-sm">Sabor activo</Label>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1" disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? 'Actualizar Sabor' : 'Crear Sabor'}
        </Button>
      </div>
    </form>
  );
}

interface ComboFormRow {
  productId: string;
  quantity: number;
  pricePerUnit: number;
}

function ComboForm({ onClose, onSave, initialCombo, catalogProducts }: {
  onClose: () => void;
  onSave: (data: CreateSweetTableComboData) => Promise<void>;
  initialCombo?: SweetTableCombo | null;
  catalogProducts: Product[];
}) {
  const isEditing = !!initialCombo;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(initialCombo?.name || '');
  const [isActive, setIsActive] = useState(initialCombo?.isActive ?? true);
  const [rows, setRows] = useState<ComboFormRow[]>(
    initialCombo?.products.map(p => ({
      productId: p.productId,
      quantity: p.quantity,
      pricePerUnit: p.pricePerUnit,
    })) || [{ productId: '', quantity: 1, pricePerUnit: 0 }]
  );
  const [price, setPrice] = useState(initialCombo?.fixedPrice ?? initialCombo?.price ?? 0);
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const isFirstRender = useRef(true);

  const totalQuantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const computedPrice = rows.reduce((sum, r) => sum + (r.quantity || 0) * (r.pricePerUnit || 0), 0);

  // Sugiere el precio automáticamente a partir de los productos, salvo que
  // el usuario ya lo haya editado a mano. No se dispara al abrir el
  // formulario en modo edición, para no pisar el precio ya guardado.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!priceManuallyEdited) {
      setPrice(computedPrice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedPrice]);

  const addRow = () => {
    setRows([...rows, { productId: '', quantity: 1, pricePerUnit: 0 }]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRowProduct = (index: number, productId: string) => {
    const product = catalogProducts.find(p => p.id === productId);
    // basePrice puede llegar como string desde la API (DECIMAL de Postgres
    // sin castear), por lo que se normaliza explícitamente a number.
    const basePrice = product?.basePrice !== undefined ? Number(product.basePrice) : undefined;
    setRows(rows.map((row, i) =>
      i === index ? { ...row, productId, pricePerUnit: basePrice ?? row.pricePerUnit } : row
    ));
  };

  const updateRowQuantity = (index: number, quantity: number) => {
    setRows(rows.map((row, i) => i === index ? { ...row, quantity } : row));
  };

  const updateRowPricePerUnit = (index: number, pricePerUnit: number) => {
    setRows(rows.map((row, i) => i === index ? { ...row, pricePerUnit } : row));
  };

  const handleUsesSuggestedPrice = () => {
    setPrice(computedPrice);
    setPriceManuallyEdited(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('El nombre de la mesa dulce es requerido');
      return;
    }

    const validRows = rows.filter(r => r.productId);
    if (validRows.length === 0) {
      toast.error('Agrega al menos un producto a la mesa dulce');
      return;
    }

    if (validRows.some(r => !r.quantity || r.quantity <= 0)) {
      toast.error('Cada producto debe tener una cantidad mayor a 0');
      return;
    }

    if (!price || price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        fixedPrice: Number(price),
        isActive,
        products: validRows.map(r => ({
          productId: r.productId,
          quantity: Number(r.quantity),
          pricePerUnit: Number(r.pricePerUnit),
        })),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Nombre *</Label>
        <Input
          placeholder="Ej: Combo 50 postres"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Productos incluidos *</Label>
          <span className="text-xs ">Total: {totalQuantity} postres</span>
        </div>

        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-muted/50 p-2 rounded-lg">
              <Select value={row.productId} onValueChange={(v) => updateRowProduct(index, v)}>
                <SelectTrigger className="text-sm flex-1">
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {catalogProducts.map(product => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <NumberInput
                  min="1"
                  placeholder="Cant."
                  value={row.quantity}
                  onChange={(v) => updateRowQuantity(index, v)}
                  fallback={0}
                  className="text-sm w-full sm:w-20"
                />
                <NumberInput
                  min="0"
                  step="0.01"
                  placeholder="Bs./u"
                  value={row.pricePerUnit}
                  onChange={(v) => updateRowPricePerUnit(index, v)}
                  decimal
                  fallback={0}
                  className="text-sm w-full sm:w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Agregar producto
        </Button>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <Label className="text-sm">Precio (Bs.) *</Label>
          {Math.abs(computedPrice - price) > 0.01 && (
            <button
              type="button"
              onClick={handleUsesSuggestedPrice}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Usar precio sugerido: Bs. {computedPrice.toFixed(2)}
            </button>
          )}
        </div>
        <NumberInput
          min="0"
          step="0.01"
          placeholder="0"
          value={price}
          onChange={(v) => {
            setPrice(v);
            setPriceManuallyEdited(true);
          }}
          decimal
          fallback={0}
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="combo-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          className="scale-75 sm:scale-100"
        />
        <Label htmlFor="combo-active" className="text-sm">Mesa dulce activa</Label>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1" disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? 'Actualizar Mesa Dulce' : 'Crear Mesa Dulce'}
        </Button>
      </div>
    </form>
  );
}
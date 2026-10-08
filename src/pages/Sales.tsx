import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, ShoppingCart, QrCode, Banknote, X, Minus, Plus as PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem, Product } from '@/types';
import { ISalesApi, defaultSalesApi, SaleData, ReservationConflict, ReservationConflictError } from '@/api/SalesApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SalesProps {
  api?: ISalesApi;
}

export default function Sales({ api = defaultSalesApi }: SalesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr'>('cash');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<ReservationConflict[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const fetchedProducts = await api.getProducts(debouncedSearchTerm);
        setProducts(fetchedProducts);
      } catch (error) {
        toast.error('Error al cargar productos');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [api, debouncedSearchTerm]);

  const availableProducts = products;

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
        toast.success('Producto agregado al carrito');
      } else {
        toast.error('Stock insuficiente');
      }
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.basePrice
      }]);
      toast.success('Producto agregado al carrito');
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
    toast.info('Producto eliminado del carrito');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (quantity <= 0) {
      removeFromCart(productId);
    } else if (product && quantity <= product.stock) {
      setCart(cart.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ));
    } else {
      toast.error('Stock insuficiente');
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const completeSale = async (overrideReservation = false) => {
    const saleData: SaleData = {
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      total,
      paymentMethod,
      timestamp: new Date(),
      overrideReservation,
    };

    try {
      await api.createSale(saleData);
      toast.success(`Venta completada por Bs. ${total} (${paymentMethod === 'cash' ? 'Efectivo' : 'QR'})`);
      if (overrideReservation) {
        toast.info('Las líneas de pedido afectadas pasaron a producción');
      }
      setCart([]);
      setIsDialogOpen(false);
      setIsCartOpen(false);
      // Recargar productos para reflejar stock actualizado (con el mismo término de búsqueda)
      const updatedProducts = await api.getProducts(debouncedSearchTerm);
      setProducts(updatedProducts);
    } catch (error) {
      if (error instanceof ReservationConflictError) {
        setIsDialogOpen(false);
        setConflicts(error.conflicts);
        return;
      }
      toast.error(error.toString());
      console.error(error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header - Mobile first */}
        <div className="px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Ventas
            </h1>
            <p className="text-sm sm:text-base ">
              Punto de venta rápido
            </p>
          </div>
          
          {/* Cart button for mobile */}
          <div className="lg:hidden">
            <Button 
              variant="outline" 
              className="relative w-full sm:w-auto"
              onClick={() => setIsCartOpen(!isCartOpen)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Carrito
              {cart.length > 0 && (
                <Badge variant="default" className="ml-2 bg-primary">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Main grid - Mobile: stacked, Tablet/Desktop: side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Products Section */}
          <div className={`${isCartOpen ? 'hidden' : 'block'} lg:block lg:col-span-2 space-y-4`}>
            {/* Search */}
            <div className="px-4 sm:px-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " />
                <Input 
                  placeholder="Buscar productos..." 
                  className="pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="">Cargando productos...</p>
              </div>
            ):(
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-0">
                {availableProducts.map(product => (
                  <Card 
                    key={product.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow active:scale-95 sm:active:scale-100"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="aspect-square bg-muted rounded-lg mb-2 sm:mb-3 flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 " />
                      </div>
                      <span className="font-medium text-sm sm:text-sm truncate">{product.name}</span>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <span className="font-bold text-primary text-sm sm:text-base">Bs. {product.basePrice}</span>
                        <Badge variant="secondary" className="text-xs w-fit">
                          {product.stock} u.{product.reservedStock ? ` (${product.reservedStock} reserv.)` : ''}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* Products Grid - Mobile: 2 columnas, Tablet: 3 columnas, Desktop: 3 columnas */}

            {availableProducts.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="">No se encontraron productos</p>
              </div>
            )}
          </div>

          {/* Cart Section - Mobile: toggle, Desktop: always visible */}
          <div className={`
            ${!isCartOpen ? 'hidden' : 'block'} 
            lg:block lg:col-span-1
            fixed lg:relative
            inset-x-0 bottom-0 top-16 lg:top-0
            bg-background lg:bg-transparent
            z-50 lg:z-0
            overflow-auto
            p-4 lg:p-0
            border-t lg:border-t-0
          `}>
            <Card className="h-full">
              <CardHeader className="pb-3 px-4 py-3 sm:px-6 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                  Carrito
                  {cart.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}
                    </Badge>
                  )}
                </CardTitle>
                {/* Close button for mobile */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden h-8 w-8"
                  onClick={() => setIsCartOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 sm:px-6">
                {cart.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 mx-auto /30 mb-3" />
                    <p className="text-sm sm:text-base ">
                      Carrito vacío
                    </p>
                    <p className="text-xs /70 mt-1 lg:hidden" onClick={() => setIsCartOpen(false)}>
                      Toca un producto para agregar
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-[40vh] lg:max-h-[60vh] overflow-auto pr-1">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-start gap-2 p-2 sm:p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs  mt-0.5">
                              Bs. {item.price} c/u
                            </p>
                            <p className="text-xs font-medium mt-1">
                              Subtotal: Bs. {item.price * item.quantity}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => removeFromCart(item.productId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-xs sm:text-sm">{item.quantity}</span>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              >
                                <PlusIcon className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between text-base sm:text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-primary">Bs. {total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" size="default">
                          Cobrar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] sm:w-full max-w-md rounded-lg">
                        <DialogHeader>
                          <DialogTitle className="text-lg sm:text-xl">Completar Venta</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2 sm:py-4">
                          <div className="text-center">
                            <p className="text-2xl sm:text-3xl font-bold text-primary">Bs. {total.toLocaleString()}</p>
                            <p className="text-xs sm:text-sm ">Total a cobrar</p>
                          </div>

                          {/* Payment Methods */}
                          <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-medium">Método de pago</label>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <Button 
                                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                                className="h-16 sm:h-20 flex-col gap-1 sm:gap-2"
                                onClick={() => setPaymentMethod('cash')}
                              >
                                <Banknote className="h-4 w-4 sm:h-6 sm:w-6" />
                                <span className="text-xs sm:text-sm">Efectivo</span>
                              </Button>
                              <Button 
                                variant={paymentMethod === 'qr' ? 'default' : 'outline'}
                                className="h-16 sm:h-20 flex-col gap-1 sm:gap-2"
                                onClick={() => setPaymentMethod('qr')}
                              >
                                <QrCode className="h-4 w-4 sm:h-6 sm:w-6" />
                                <span className="text-xs sm:text-sm">QR</span>
                              </Button>
                            </div>
                          </div>

                          {paymentMethod === 'qr' && (
                            <div className="bg-muted p-4 sm:p-6 rounded-lg text-center">
                              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto bg-white rounded-lg flex items-center justify-center border">
                                <QrCode className="h-16 w-16 sm:h-20 sm:w-20" />
                              </div>
                              <p className="text-xs sm:text-sm  mt-2">
                                Escanear para pagar Bs. {total.toLocaleString()}
                              </p>
                            </div>
                          )}

                          <Button className="w-full" size="default" onClick={() => completeSale()}>
                            Confirmar Venta
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      variant="outline" 
                      className="w-full lg:hidden"
                      onClick={() => setIsCartOpen(false)}
                    >
                      Seguir Comprando
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={!!conflicts} onOpenChange={(open) => { if (!open) setConflicts(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Stock reservado para pedidos de hoy</AlertDialogTitle>
              <AlertDialogDescription>
                Esta venta usa unidades reservadas. Si continúas, estas líneas pasarán a producción
                y habrá que reponer el stock para volver a marcarlas como "usar de stock":
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="text-sm space-y-1">
              {(conflicts || []).flatMap(c =>
                c.lines.map(line => (
                  <li key={line.id}>
                    <span className="font-medium">{products.find(p => p.id === c.productId)?.name}</span>
                    {' — '}{line.orderNumber}, {line.quantity} u., retira {line.pickupTime || 'sin hora'}
                  </li>
                ))
              )}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConflicts(null); completeSale(true); }}>
                Vender y mandar a producción
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isCartOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setIsCartOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}
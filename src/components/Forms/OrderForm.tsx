import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, Plus, QrCode, X } from 'lucide-react';
import { format } from 'date-fns';
import { CreateOrderData, CustomCake, Order, UpdateOrderData, OrderItem, OrderCombo, ComboProduct, SweetTableCombo } from '@/types';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getLocalDateString } from '@/utils/DateUtils';
import { es } from 'date-fns/locale';

export interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: CreateOrderData | UpdateOrderData) => void;
  onClose: () => void;
  products: any[];
  flavors: any[];
  sweetTableCombos?: SweetTableCombo[];
  isEditing?: boolean;
}

export default function OrderForm({ initialData, onSubmit, onClose, products, flavors, sweetTableCombos = [], isEditing = false }: OrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateOrderData | UpdateOrderData>(() => {
    if (initialData) {
      return {
        customerName: initialData.customerName,
        customerPhone: initialData.customerPhone,
        pickupDate: initialData.pickupDate,
        pickupTime: initialData.pickupTime,
        items: initialData.items,
        customCakes: initialData.customCakes,
        sweetTableCombos: initialData.sweetTableCombos ? initialData.sweetTableCombos.map(c => ({
          ...c,
          products: c.products.map(p => ({ ...p }))
        })) : [],
        sweetTableExtras: initialData.sweetTableExtras ? initialData.sweetTableExtras.map(e => ({ ...e })) : [],
        deliveryAddress: initialData.deliveryAddress,
        deliveryCost: initialData.deliveryCost,
        deposit: initialData.deposit,
        depositMethod: initialData.depositMethod,
        discount: initialData.discount,
        notes: initialData.notes,
        paymentMethod: 'cash',
      };
    }
    return {
      customerName: '',
      customerPhone: '',
      pickupDate: new Date(new Date().setHours(0, 0, 0, 0)),
      pickupTime: '12:00',
      items: [],
      customCakes: [],
      sweetTableCombos: [],
      sweetTableExtras: [],
      deliveryCost: 0,
      deposit: 0,
      discount: 0,
      notes: '',
      paymentMethod: 'cash',
    };
  });

  const [showSweetTableSection, setShowSweetTableSection] = useState(
    (formData.sweetTableCombos?.length || 0) > 0 || (formData.sweetTableExtras?.length || 0) > 0
  );

  const selectedOptions = {
    hasCake: (formData.customCakes?.length || 0) > 0,
    hasProducts: (formData.items?.length || 0) > 0,
    hasSweetTable: (formData.sweetTableCombos?.length || 0) > 0 || (formData.sweetTableExtras?.length || 0) > 0
  };

  const calculateSubtotal = () => {
    let subtotal = 0;
    
    (formData.customCakes || []).forEach(cake => {
      subtotal += (cake.price || 0) * cake.quantity;
    });
    
    (formData.items || []).forEach(item => {
      subtotal += (item.price || 0) * item.quantity;
    });

    (formData.sweetTableCombos || []).forEach(combo => {
      subtotal += combo.price || 0;
    });

    (formData.sweetTableExtras || []).forEach(extra => {
      subtotal += (extra.price || 0) * (extra.quantity || 0);
    });
    
    return subtotal;
  };

  const sweetTableExtrasTotal = () => {
    return (formData.sweetTableExtras || []).reduce(
      (sum, extra) => sum + (extra.price || 0) * (extra.quantity || 0), 0
    );
  };

  const comboQuantitySum = (combo: OrderCombo) => {
    return (combo.products || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
  };

  const calculateTotal = () => {
    let total = calculateSubtotal();
    
    if (formData.discount) {
      total -= formData.discount;
    }
    
    if (formData.deliveryCost) {
      total += formData.deliveryCost;
    }
    
    return total;
  };

  const subtotal = calculateSubtotal();
  const total = calculateTotal();

  const cakeFlavors = flavors.filter((f: any) => f.type === 'cake' && f.isActive);
  const fillingFlavors = flavors.filter((f: any) => f.type === 'filling' && f.isActive);
  const catalogProducts = products.filter((p: any) => p.isActive && p.location === 'store');

  const addCake = () => {
    const newCake: Partial<CustomCake> = {
      portions: 15,
      quantity: 1,
      cakeFlavor: '',
      secondCakeFlavor: '',
      fillingFlavor: '',
      secondFillingFlavor: '',
      price: 0,
      id: Date.now().toString()
    };
    setFormData({
      ...formData,
      customCakes: [...(formData.customCakes || []), newCake as CustomCake]
    });
  };

  const removeCake = (index: number) => {
    const updated = [...(formData.customCakes || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, customCakes: updated });
  };

  const updateCake = (index: number, field: keyof CustomCake, value: any) => {
    const updated = [...(formData.customCakes || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, customCakes: updated });
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), { productId: '', quantity: 1, product: {} as any, price: 0 }]
    });
  };

  const removeProduct = (index: number) => {
    const updated = [...(formData.items || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const updateProduct = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...(formData.items || [])];
    if (field === 'productId') {
      const selectedProduct = catalogProducts.find(p => p.id === value);
      if (selectedProduct) {
        updated[index] = {
          ...updated[index],
          productId: value,
          product: selectedProduct,
          price: selectedProduct.basePrice
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormData({ ...formData, items: updated });
  };

  const addSweetTableCombo = (presetId: string) => {
    const preset = sweetTableCombos.find(c => c.id === presetId);
    if (!preset) return;

    const newCombo: OrderCombo = {
      comboId: preset.id,
      name: preset.name,
      totalQuantity: preset.totalQuantity,
      price: preset.fixedPrice ?? preset.price ?? 0,
      products: (preset.products || []).map(p => ({
        productId: p.productId,
        product: catalogProducts.find((cp: any) => cp.id === p.productId),
        productName: p.productName,
        quantity: p.quantity,
        pricePerUnit: p.pricePerUnit
      })),
      details: ''
    };

    setFormData({
      ...formData,
      sweetTableCombos: [...(formData.sweetTableCombos || []), newCombo]
    });
  };

  const removeSweetTableCombo = (comboIndex: number) => {
    const updated = [...(formData.sweetTableCombos || [])];
    updated.splice(comboIndex, 1);
    setFormData({ ...formData, sweetTableCombos: updated });
  };

  const updateSweetTableComboDetails = (comboIndex: number, details: string) => {
    const updated = [...(formData.sweetTableCombos || [])];
    updated[comboIndex] = { ...updated[comboIndex], details };
    setFormData({ ...formData, sweetTableCombos: updated });
  };

  const addComboProduct = (comboIndex: number) => {
    const updated = [...(formData.sweetTableCombos || [])];
    const combo = { ...updated[comboIndex] };
    combo.products = [...combo.products, { productId: '', product: {} as any, quantity: 1, pricePerUnit: 0 }];
    updated[comboIndex] = combo;
    setFormData({ ...formData, sweetTableCombos: updated });
  };

  const removeComboProduct = (comboIndex: number, productIndex: number) => {
    const updated = [...(formData.sweetTableCombos || [])];
    const combo = { ...updated[comboIndex] };
    combo.products = combo.products.filter((_, i) => i !== productIndex);
    updated[comboIndex] = combo;
    setFormData({ ...formData, sweetTableCombos: updated });
  };

  const updateComboProduct = (comboIndex: number, productIndex: number, field: keyof ComboProduct, value: any) => {
    const updated = [...(formData.sweetTableCombos || [])];
    const combo = { ...updated[comboIndex] };
    const comboProducts = [...combo.products];

    if (field === 'productId') {
      const selectedProduct = catalogProducts.find((p: any) => p.id === value);
      comboProducts[productIndex] = {
        ...comboProducts[productIndex],
        productId: value,
        product: selectedProduct || ({} as any),
        pricePerUnit: selectedProduct ? selectedProduct.basePrice : comboProducts[productIndex].pricePerUnit
      };
    } else {
      comboProducts[productIndex] = { ...comboProducts[productIndex], [field]: value };
    }

    combo.products = comboProducts;
    updated[comboIndex] = combo;
    setFormData({ ...formData, sweetTableCombos: updated });
  };

  const addExtra = () => {
    setFormData({
      ...formData,
      sweetTableExtras: [...(formData.sweetTableExtras || []), { productId: '', product: {} as any, quantity: 1, price: 0 }]
    });
  };

  const removeExtra = (index: number) => {
    const updated = [...(formData.sweetTableExtras || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, sweetTableExtras: updated });
  };

  const updateExtra = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...(formData.sweetTableExtras || [])];
    if (field === 'productId') {
      const selectedProduct = catalogProducts.find((p: any) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        product: selectedProduct || ({} as any),
        price: selectedProduct ? selectedProduct.basePrice : updated[index].price
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormData({ ...formData, sweetTableExtras: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName || !formData.customerPhone || !formData.pickupDate || !formData.pickupTime) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    if (!selectedOptions.hasCake && !selectedOptions.hasProducts && !selectedOptions.hasSweetTable) {
      toast.error('Debe seleccionar al menos un tipo de producto');
      return;
    }

    for (const combo of formData.sweetTableCombos || []) {
      const sum = comboQuantitySum(combo);
      if (sum !== combo.totalQuantity) {
        toast.error(
          `${combo.name || 'La mesa dulce'} debe sumar exactamente ${combo.totalQuantity} porciones (actualmente suma ${sum})`
        );
        return;
      }
      if (combo.products.some(p => !p.productId)) {
        toast.error(`${combo.name || 'La mesa dulce'} tiene un producto sin seleccionar`);
        return;
      }
    }

    if ((formData.sweetTableExtras || []).some(e => !e.productId)) {
      toast.error('Hay un postre adicional sin producto seleccionado');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const hasSweetTableFinal = selectedOptions.hasSweetTable;
    const typesSelected = [selectedOptions.hasCake, selectedOptions.hasProducts, hasSweetTableFinal].filter(Boolean).length;
    
    const submitData = {
      ...formData,
      total,
      orderType: typesSelected > 1 ? 'mixed' :
                  selectedOptions.hasCake ? 'cake' :
                  selectedOptions.hasProducts ? 'products' : 'sweet_table'
    };
    
    try {
      await onSubmit(submitData);
    } catch (error) {
      console.error('Error al enviar el pedido:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormField = (field: keyof typeof formData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Nombre del cliente *</Label>
          <Input 
            placeholder="Nombre completo" 
            required 
            className="text-sm"
            value={formData.customerName || ''}
            onChange={(e) => updateFormField('customerName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Teléfono *</Label>
          <Input 
            placeholder="Número de teléfono" 
            required 
            className="text-sm"
            value={formData.customerPhone || ''}
            onChange={(e) => updateFormField('customerPhone', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Fecha de entrega *</Label>
          <Input 
            type="date" 
            required 
            className="text-sm"
            min={getLocalDateString()}
            value={formData.pickupDate instanceof Date ? format(formData.pickupDate, 'yyyy-MM-dd', { locale: es }) : formData.pickupDate}
            onChange={(e) => {
              const [year, month, day] = e.target.value.split('-');
              const localDate = new Date(Number(year), Number(month) - 1, Number(day));
              updateFormField('pickupDate', localDate)
            }}
          />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Hora de entrega *</Label>
          <Input 
            type="time" 
            required 
            className="text-sm"
            value={formData.pickupTime || ''}
            onChange={(e) => updateFormField('pickupTime', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 sm:justify-self-center justify-self-start">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={selectedOptions.hasCake}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      setFormData({ ...formData, customCakes: [] });
                    } else if ((formData.customCakes?.length || 0) === 0) {
                      addCake();
                    }
                  }}
                  className="sr-only peer"
                  id="hasCake"
                />
                <div className="w-5 h-5 border-2 rounded-md border-muted-foreground/30 peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center group-hover:border-primary/50">
                  <svg 
                    className="w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity duration-200" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <label htmlFor="hasCake" className="text-sm font-medium cursor-pointer select-none group-hover:text-primary transition-colors">
                Torta personalizada
              </label>
            </div>
          </label>
          
          <label className="flex items-center gap-2 sm:justify-self-center justify-self-start">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={selectedOptions.hasProducts}
                onChange={(e) => {
                  if (!e.target.checked) {
                    setFormData({ ...formData, items: [] });
                  } else if ((formData.items?.length || 0) === 0) {
                    addProduct();
                  }
                }}
                className="sr-only peer"
                id='hasItems'
              />
              <div className="w-5 h-5 border-2 rounded-md border-muted-foreground/30 peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center group-hover:border-primary/50">
                <svg 
                  className="w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity duration-200" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm">Productos del catálogo</span>
          </label>
          
          <label className="flex items-center gap-2 sm:justify-self-center justify-self-start">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={showSweetTableSection}
                onChange={(e) => {
                  setShowSweetTableSection(e.target.checked);
                  if (!e.target.checked) {
                    setFormData({ ...formData, sweetTableCombos: [], sweetTableExtras: [] });
                  }
                }}
                className="sr-only peer"
                id='hasSweetTable'
              />
              <div className="w-5 h-5 border-2 rounded-md border-muted-foreground/30 peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center group-hover:border-primary/50">
                <svg 
                  className="w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity duration-200" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm">Mesa dulce</span>
          </label>
        </div>
      </div>

      {selectedOptions.hasCake && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-base">Tortas Personalizadas</h3>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={addCake}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar Torta
            </Button>
          </div>
          
          {(formData.customCakes || []).map((cake, index) => (
            <div key={cake.id || index} className="border rounded-lg p-3 space-y-3 relative">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">Torta #{index + 1}</span>
                {(formData.customCakes?.length || 0) > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeCake(index)}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Cantidad</Label>
                  <NumberInput
                    min="1"
                    value={cake.quantity}
                    onChange={(v) => updateCake(index, 'quantity', v)}
                    fallback={1}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Porciones por torta</Label>
                  <Select 
                    value={cake.portions?.toString()}
                    onValueChange={(v) => updateCake(index, 'portions', parseInt(v))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 25, 30, 40, 50].map(p => (
                        <SelectItem key={p} value={p.toString()}>{p} porciones</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Forma (opcional)</Label>
                  <Select 
                    value={cake.shape}
                    onValueChange={(v) => updateCake(index, 'shape', v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="redonda">Redonda</SelectItem>
                      <SelectItem value="cuadrada">Cuadrada</SelectItem>
                      <SelectItem value="rectangular">Rectangular</SelectItem>
                      <SelectItem value="corazon">Corazón</SelectItem>
                      <SelectItem value="dos-pisos">Dos pisos</SelectItem>
                      <SelectItem value="tres-pisos">Tres pisos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Sabor de torta *</Label>
                  <Select 
                    value={cake.cakeFlavor || undefined}
                    onValueChange={(v) => updateCake(index, 'cakeFlavor', v)}
                    required
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {cakeFlavors.map((f: any) => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Sabor de relleno *</Label>
                  <Select
                    value={cake.fillingFlavor || undefined}
                    onValueChange={(v) => updateCake(index, 'fillingFlavor', v)}
                    required
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {fillingFlavors.map((f: any) => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Segundo sabor de torta (opcional)</Label>
                  <Select 
                    value={cake.secondCakeFlavor || "none"}
                    onValueChange={(v) => updateCake(index, 'secondCakeFlavor', v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {cakeFlavors.map((f: any) => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Segundo sabor de relleno (opcional)</Label>
                  <Select
                    value={cake.secondFillingFlavor || "none"}
                    onValueChange={(v) => updateCake(index, 'secondFillingFlavor', v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {fillingFlavors.map((f: any) => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Descripción del diseño</Label>
                <Textarea 
                  placeholder="Describe el diseño deseado..." 
                  className="text-sm" 
                  rows={2}
                  value={cake.design || ''}
                  onChange={(e) => updateCake(index, 'design', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Dedicatoria (opcional)</Label>
                <Input 
                  placeholder="Texto para la torta" 
                  className="text-sm"
                  value={cake.dedication || ''}
                  onChange={(e) => updateCake(index, 'dedication', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Precio (Bs.) *</Label>
                <NumberInput
                  placeholder="0"
                  required
                  className="text-sm"
                  value={cake.price}
                  onChange={(v) => updateCake(index, 'price', v)}
                  decimal
                  fallback={0}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOptions.hasProducts && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-base">Productos del Catálogo</h3>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={addProduct}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar Producto
            </Button>
          </div>
          
          {(formData.items || []).map((item, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">Producto #{index + 1}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeProduct(index)}
                  className="text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Producto *</Label>
                  <Select 
                    value={item.productId}
                    onValueChange={(v) => updateProduct(index, 'productId', v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogProducts.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - Bs. {p.basePrice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Cantidad *</Label>
                  <NumberInput
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(v) => updateProduct(index, 'quantity', v)}
                    fallback={1}
                    className="text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-sm">Notas (opcional)</Label>
                <Input 
                  placeholder="Ej: Sin gluten, decoración especial..." 
                  className="text-sm"
                  value={item.notes || ''}
                  onChange={(e) => updateProduct(index, 'notes', e.target.value)}
                />
              </div>
            </div>
          ))}
          
          {(formData.items || []).length === 0 && (
            <p className="text-sm  text-center py-4">
              No hay productos agregados. Haz clic en "Agregar Producto" para comenzar.
            </p>
          )}
        </div>
      )}

      {showSweetTableSection && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="font-semibold text-base">Mesa Dulce</h3>
            <div className="flex items-center gap-2">
              <Select onValueChange={(v) => addSweetTableCombo(v)} value="">
                <SelectTrigger className="text-sm w-full sm:w-64">
                  <SelectValue placeholder="Agregar mesa predeterminada..." />
                </SelectTrigger>
                <SelectContent>
                  {sweetTableCombos.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No hay mesas dulces configuradas
                    </div>
                  )}
                  {sweetTableCombos.map((combo) => (
                    <SelectItem key={combo.id} value={combo.id}>
                      {combo.name} — {combo.totalQuantity} porciones — Bs. {combo.fixedPrice ?? combo.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mesas dulces predeterminadas seleccionadas */}
          {(formData.sweetTableCombos || []).length === 0 ? (
            <p className="text-sm text-center py-2 text-muted-foreground">
              No hay mesas dulces agregadas. Selecciónalas del listado de arriba.
            </p>
          ) : (
            (formData.sweetTableCombos || []).map((combo, comboIndex) => {
              const qtySum = comboQuantitySum(combo);
              const isValid = qtySum === combo.totalQuantity;
              return (
                <div key={combo.id || comboIndex} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium text-sm">{combo.name || `Mesa dulce #${comboIndex + 1}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Precio fijo: Bs. {combo.price} (no cambia al modificar los productos)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSweetTableCombo(comboIndex)}
                      className="text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {combo.products.map((p, productIndex) => (
                      <div key={productIndex} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Producto</Label>
                          <Select
                            value={p.productId}
                            onValueChange={(v) => updateComboProduct(comboIndex, productIndex, 'productId', v)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {catalogProducts.map((cp: any) => (
                                <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cantidad</Label>
                          <NumberInput
                            min="0"
                            className="text-sm"
                            value={p.quantity}
                            onChange={(v) => updateComboProduct(comboIndex, productIndex, 'quantity', v)}
                            fallback={0}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComboProduct(comboIndex, productIndex)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addComboProduct(comboIndex)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar producto a la mesa
                    </Button>

                    <p className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-destructive'}`}>
                      Total: {qtySum} / {combo.totalQuantity} porciones {isValid ? '✓' : '(debe coincidir exactamente)'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Detalles (opcional)</Label>
                    <Textarea
                      placeholder="Presentación, colores, indicaciones..."
                      className="text-sm"
                      rows={2}
                      value={combo.details || ''}
                      onChange={(e) => updateSweetTableComboDetails(comboIndex, e.target.value)}
                    />
                  </div>
                </div>
              );
            })
          )}

          {/* Postres adicionales agregados manualmente */}
          <div className="border-t pt-3 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-sm">Postres adicionales</h4>
              <Button type="button" variant="outline" size="sm" onClick={addExtra}>
                <Plus className="h-4 w-4 mr-1" /> Agregar postre
              </Button>
            </div>

            {(formData.sweetTableExtras || []).length === 0 ? (
              <p className="text-sm text-center py-2 text-muted-foreground">
                Sin postres adicionales. Estos se agregan por separado de las mesas dulces.
              </p>
            ) : (
              (formData.sweetTableExtras || []).map((extra, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_90px_auto] gap-2 items-end border rounded-lg p-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Producto</Label>
                    <Select
                      value={extra.productId}
                      onValueChange={(v) => updateExtra(index, 'productId', v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogProducts.map((cp: any) => (
                          <SelectItem key={cp.id} value={cp.id}>
                            {cp.name} - Bs. {cp.basePrice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <NumberInput
                      min="1"
                      className="text-sm"
                      value={extra.quantity}
                      onChange={(v) => updateExtra(index, 'quantity', v)}
                      fallback={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subtotal</Label>
                    <p className="text-sm font-medium py-2">Bs. {((extra.price || 0) * (extra.quantity || 0)).toFixed(2)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExtra(index)}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}

            {(formData.sweetTableExtras || []).length > 0 && (
              <p className="text-sm font-medium text-right">
                Total adicionales: Bs. {sweetTableExtrasTotal().toFixed(2)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delivery y Pago */}
      <div className="space-y-3 sm:space-y-4 border-t pt-3 sm:pt-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Dirección de envío (opcional)</Label>
          <Input 
            placeholder="Dirección o link de ubicación" 
            className="text-sm"
            value={formData.deliveryAddress || ''}
            onChange={(e) => updateFormField('deliveryAddress', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Costo de envío</Label>
            <NumberInput
              placeholder="0"
              className="text-sm"
              value={formData.deliveryCost}
              onChange={(v) => updateFormField('deliveryCost', v)}
              decimal
              fallback={0}
            />
          </div>
          {/*
            <div className="space-y-1.5">
              <Label className="text-sm">Garantía (opcional)</Label>
              <Input 
                placeholder="Descripción de garantía" 
                className="text-sm"
                value={formData.guarantee?.items || ''}
                onChange={(e) => updateFormField('guarantee', { amount: formData.guarantee?.amount || 0, items: e.target.value })}
              />
            </div>
          */}
        </div>
      </div>

      {/* Payment */}
      <div className="space-y-3 sm:space-y-4 border-t pt-3 sm:pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Adelanto *</Label>
            <NumberInput
              placeholder="0"
              required
              className="text-sm"
              value={formData.deposit}
              onChange={(v) => updateFormField('deposit', v)}
              decimal
              fallback={0}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Descuento</Label>
            <NumberInput
              placeholder="0"
              className="text-sm"
              value={formData.discount}
              onChange={(v) => updateFormField('discount', v)}
              decimal
              fallback={0}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Notas adicionales</Label>
        <Textarea 
          placeholder="Observaciones del pedido..." 
          className="text-sm" 
          rows={3}
          value={formData.notes || ''}
          onChange={(e) => updateFormField('notes', e.target.value)}
        />
      </div>

      <div className="space-y-3 bg-muted/20 rounded-lg p-4 border">
        <div className="flex justify-between items-center py-2">
          <span className="font-medium text-sm">Subtotal:</span>
          <span className="text-lg font-semibold text-primary">
            Bs. {subtotal.toFixed(2)}
          </span>
        </div>
        
        {formData.discount > 0 && (
          <div className="flex justify-between items-center py-2 text-sm ">
            <span>Descuento:</span>
            <span className="text-destructive">- Bs. {formData.discount.toFixed(2)}</span>
          </div>
        )}
        
        {formData.deliveryCost > 0 && (
          <div className="flex justify-between items-center py-2 text-sm ">
            <span>Costo de envío:</span>
            <span>+ Bs. {formData.deliveryCost.toFixed(2)}</span>
          </div>
        )}
        
        <div className="border-t pt-3 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-base font-bold">Total a pagar:</span>
            <span className="text-2xl font-bold text-primary">
              Bs. {total.toFixed(2)}
            </span>
          </div>
        </div>
        
        {formData.deposit > 0 && (
          <div className="flex justify-between items-center py-2 text-sm bg-muted p-2 rounded mt-2">
            <span className="font-medium">Adelanto:</span>
            <span className="text-green-600 font-medium">
              Bs. {formData.deposit.toFixed(2)}
            </span>
          </div>
        )}
        
        {formData.deposit > 0 && total > 0 && (
          <div className="flex justify-between items-center py-2 text-sm font-medium">
            <span>Saldo pendiente:</span>
            <span className="text-lg font-semibold text-orange-600">
              Bs. {(total - formData.deposit).toFixed(2)}
            </span>
          </div>
        )}

        {formData.deposit > 0 && (
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium">Método de pago</label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Button 
                type="button"
                variant={formData.paymentMethod === 'cash' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFormField('paymentMethod', 'cash')}
              >
                <Banknote className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Efectivo</span>
              </Button>
              <Button 
                type="button"
                variant={formData.paymentMethod === 'qr' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFormField('paymentMethod', 'qr')}
              >
                <QrCode className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">QR</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose} 
          className="w-full sm:w-auto order-2 sm:order-1"
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="w-full sm:w-auto order-1 sm:order-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              {isEditing ? 'Actualizando...' : 'Creando...'}
            </>
          ) : (
            isEditing ? 'Actualizar Pedido' : 'Crear Pedido'
          )}
        </Button>
      </div>
    </form>
  );
}

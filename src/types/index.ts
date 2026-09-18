// Dashboard Types
export interface TodaysResume {
    todaySales:           number;
    orders:               Orders;
    lowStock:             number;
    yesterdayComparation: string;
}

export interface Orders {
    pending:          number;
    inProduction:     number;
    readyForDelivery: number;
    completedToday:   number;
}

export type ProductStatus =
  | 'pending'
  | 'baking'
  | 'assembling'
  | 'decorating'
  | 'ready'
  | 'delivered'

export interface RecentOrders {
    id:       string;
    customer: string;
    product:  string;
    status:   ProductStatus;
    time:     string;
}

// Sales Types

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

// User & Authentication Types
export type UserRole = 
  | 'admin' 
  | 'seller' 
  | 'baker' 
  | 'designer' 
  | 'assembler' 
  | 'delivery';

export interface User {
  id: string;
  username: string;
  name: string;
  roles: UserRole[];
  isActive?: boolean;
}

export interface CreateUser {
  username: string;
  password: string;
  name: string;
  roles: UserRole[];
}

// Inventory Types
export interface Category {
  id: string;
  name: string;
  type: 'raw_material' | 'baked_product' | 'all';
  icon?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minStock: number;
  category: string;
  lastUpdated: Date;
}

export interface BakedProduct {
  id: string;
  name: string;
  type: 'cake_base' | 'cupcake' | 'cookie' | 'bread' | 'pastry';
  quantity: number;
  minStock: number;
  expiresAt?: Date;
  createdAt: Date;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: 'cake' | 'cupcake' | 'dessert' | 'bread' | 'special';
  image?: string;
  portionSize: number;
  pricePerPortion: number;
  isActive: boolean;
  location: 'production' | 'store';
  stock: number;
  minStock: number;
}

// Flavor Types
export interface Flavor {
  id: string;
  name: string;
  type: 'cake' | 'filling';
  isActive: boolean;
}

export interface CreateProductData {
  name: string;
  description: string;
  category: 'cake' | 'cupcake' | 'dessert' | 'bread' | 'special';
  location: 'production' | 'store';
  basePrice: number;
  pricePerPortion: number;
  stock: number;
  minStock: number;
  isActive: boolean;
}

export interface EditProductData extends Partial<CreateProductData> {
  id: string;
}

export interface AddStockData {
  productId: string;
  quantity: number;
}

export interface CreateFlavorData {
  name: string;
  type: 'cake' | 'filling';
  isActive: boolean;
}

export interface EditFlavorData extends Partial<CreateFlavorData> {
  id: string;
}

// Menu Types
export interface SpecialMenu {
  id: string;
  name: string;
  eventDate: Date;
  startDate: Date;
  endDate: Date;
  products: MenuProduct[];
  isActive: boolean;
}

export interface MenuProduct {
  productId: string;
  product: Product;
  specialPrice?: number;
  isExclusive: boolean;
}

// Sweet Table Combo Types
export interface SweetTableCombo {
  id: string;
  name: string;
  totalQuantity: number;
  fixedPrice?: number;
  price: number;
  products: ComboProduct[];
  isPreset: boolean;
  details?: string;
  isActive: boolean;
}

export interface ComboProduct {
  productId: string;
  product?: Product;
  productName?: string;
  quantity: number;
  pricePerUnit: number;
}

export interface CreateSweetTableComboData {
  name: string;
  fixedPrice: number;
  isActive: boolean;
  products: {
    productId: string;
    quantity: number;
    pricePerUnit: number;
  }[];
}

export interface EditSweetTableComboData extends Partial<CreateSweetTableComboData> {
  id: string;
}

// Order Types
export type OrderType = 'cake' | 'products' | 'sweet_table' | 'mixed';

export type OrderStatus = 
  | 'pending' 
  | 'baking' 
  | 'assembling' 
  | 'decorating' 
  | 'ready' 
  | 'delivered' 
  | 'cancelled';

export type PaymentMethod = 'cash' | 'qr';

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  pickupDate: Date;
  pickupTime: string;
  status: OrderStatus;
  items: OrderItem[];
  customCakes: CustomCake[];
  sweetTableCombos?: OrderCombo[];
  sweetTableExtras?: OrderItem[];
  deliveryAddress?: string;
  deliveryCost: number;
  deposit: number;
  depositMethod?: PaymentMethod;
  total: number;
  discount?: number;
  couponCode?: string;
  guarantee?: OrderGuarantee;
  notes?: string;
  createdAt: Date;
  createdBy: string;
  createdByUsername?: string
}

export interface OrderItem {
  productId: string;
  product: Product;
  productName?: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface CustomCake {
  id: string;
  portions: number;
  shape?: string;
  cakeFlavor: string;
  secondCakeFlavor: string;
  fillingFlavor: string;
  secondFillingFlavor: string;
  design?: string;
  dedication?: string;
  referenceImages: string[];
  price: number;
  quantity: number;
}

export interface OrderCombo {
  id?: string;
  comboId?: string;
  name?: string;
  products: ComboProduct[];
  totalQuantity: number;
  price: number;
  details?: string;
}

export interface OrderGuarantee {
  amount: number;
  items: string;
}

export interface CreateOrderData {
  orderType: 'cake' | 'products' | 'sweet_table' | 'mixed';
  customerName: string;
  customerPhone: string;
  pickupDate: Date;
  pickupTime: string;
  items?: OrderItem[];
  customCakes?: CustomCake[];
  sweetTableCombos?: OrderCombo[];
  sweetTableExtras?: OrderItem[];
  deliveryAddress?: string;
  deliveryCost?: number;
  deposit: number;
  depositMethod?: PaymentMethod;
  discount?: number;
  couponCode?: string;
  notes?: string;
  guarantee?: OrderGuarantee;
  paymentMethod?: 'cash' | 'qr' | 'both';
}

export interface UpdateOrderData {
  customerName?: string;
  customerPhone?: string;
  pickupDate?: Date;
  pickupTime?: string;
  status?: OrderStatus;
  items?: OrderItem[];
  customCakes?: CustomCake[];
  sweetTableCombos?: OrderCombo[];
  sweetTableExtras?: OrderItem[];
  deliveryAddress?: string;
  deliveryCost?: number;
  deposit?: number;
  depositMethod?: 'cash' | 'qr';
  discount?: number;
  notes?: string;
  guarantee?: OrderGuarantee;
  paymentMethod?: 'cash' | 'qr' | 'both';
}

export interface OrderFilters {
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
  customerName?: string;
  customerPhone?: string;
}

// Cash Register Types
export interface CashRegister {
  id: string;
  date: Date;
  openingBalance: number;
  closingBalance?: number;
  transactions: Transaction[];
  status: 'open' | 'closed';
}

export interface Transaction {
  id: string;
  type: 'sale' | 'deposit' | 'expense' | 'adjustment';
  amount: number;
  method: PaymentMethod;
  orderId?: string;
  description: string;
  createdAt: Date;
  createdBy: string;
}

// Interfaz para el resumen diario
export interface DailySummary {
  cashIncome: number;        // Ingresos en efectivo
  qrIncome: number;         // Ingresos por QR
  totalIncome: number;      // Ingresos totales del día
  totalExpenses: number;    // Gastos del día
  openingBalance: number;   // Saldo de apertura
  currentCashBalance: number; // Saldo actual en efectivo
  currentQrBalance: number;   // Saldo actual en QR
  transactions: Transaction[]; // Transacciones del día
}

// Interfaz para cierre de caja
export interface ClosingData {
  countedCash: number;      // Monto contado en caja
  openingBalanceTomorrow: number; // Saldo inicial para mañana
  notes?: string;           // Notas opcionales
  actualCashDifference: number; // Diferencia entre lo esperado y lo contado
}

// Branch Types
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMain: boolean;
}

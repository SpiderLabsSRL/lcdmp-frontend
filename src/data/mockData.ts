import { Product, RawMaterial, BakedProduct, Order, Flavor, SpecialMenu, SweetTableCombo, CashRegister, Branch, UserRole, User } from '@/types';

export const mockUsers: User[] = [
  { id: '1', username: 'admin@lacasademipa.com', name: 'Carlos Administrador', roles: ['admin'] as UserRole[]},
  { id: '2', username: 'vendedor@lacasademipa.com', name: 'María Vendedora', roles: ['seller'] as UserRole[]},
  { id: '3', username: 'panadero@lacasademipa.com', name: 'Juan Panadero', roles: ['baker'] as UserRole[]},
  { id: '4', username: 'decorador@lacasademipa.com', name: 'Ana Decoradora', roles: ['designer'] as UserRole[]},
  { id: '5', username: 'armador@lacasademipa.com', name: 'Pedro Armador', roles: ['assembler'] as UserRole[]},
  { id: '6', username: 'delivery@lacasademipa.com', name: 'Luis Delivery', roles: ['delivery'] as UserRole[]},
];

// Raw Materials
export const mockRawMaterials: RawMaterial[] = [
  { id: '1', name: 'Harina', unit: 'kg', quantity: 50, minStock: 20, category: 'flour', lastUpdated: new Date() },
  { id: '2', name: 'Leche', unit: 'L', quantity: 30, minStock: 15, category: 'dairy', lastUpdated: new Date() },
  { id: '3', name: 'Azúcar', unit: 'kg', quantity: 25, minStock: 10, category: 'sugar', lastUpdated: new Date() },
  { id: '4', name: 'Huevos', unit: 'unidad', quantity: 120, minStock: 50, category: 'eggs', lastUpdated: new Date() },
  { id: '5', name: 'Crema de leche', unit: 'L', quantity: 8, minStock: 5, category: 'dairy', lastUpdated: new Date() },
  { id: '6', name: 'Mantequilla', unit: 'kg', quantity: 10, minStock: 5, category: 'dairy', lastUpdated: new Date() },
  { id: '7', name: 'Esencia de vainilla', unit: 'ml', quantity: 500, minStock: 200, category: 'flavoring', lastUpdated: new Date() },
  { id: '8', name: 'Cacao en polvo', unit: 'kg', quantity: 5, minStock: 2, category: 'flavoring', lastUpdated: new Date() },
  { id: '9', name: 'Fondant', unit: 'kg', quantity: 8, minStock: 3, category: 'decoration', lastUpdated: new Date() },
  { id: '10', name: 'Colorantes', unit: 'set', quantity: 10, minStock: 3, category: 'decoration', lastUpdated: new Date() },
];

// Baked Products (semi-finished)
export const mockBakedProducts: BakedProduct[] = [
  { id: '1', name: 'Base de torta chocolate 20p', type: 'cake_base', quantity: 5, minStock: 2, createdAt: new Date() },
  { id: '2', name: 'Base de torta vainilla 20p', type: 'cake_base', quantity: 3, minStock: 2, createdAt: new Date() },
  { id: '3', name: 'Base de torta chocolate 30p', type: 'cake_base', quantity: 2, minStock: 1, createdAt: new Date() },
  { id: '4', name: 'Cupcakes vainilla', type: 'cupcake', quantity: 24, minStock: 12, createdAt: new Date() },
  { id: '5', name: 'Cupcakes chocolate', type: 'cupcake', quantity: 18, minStock: 12, createdAt: new Date() },
  { id: '6', name: 'Galletas decoradas', type: 'cookie', quantity: 36, minStock: 20, createdAt: new Date() },
];

// Finished Products
export const mockProducts: Product[] = [
  { id: '1', name: 'Torta de Chocolate', description: 'Torta clásica de chocolate con ganache', basePrice: 180, category: 'cake', portionSize: 10, pricePerPortion: 12, isActive: true, location: 'store', stock: 3, minStock: 1 },
  { id: '2', name: 'Torta de Vainilla', description: 'Torta de vainilla con buttercream', basePrice: 160, category: 'cake', portionSize: 10, pricePerPortion: 11, isActive: true, location: 'store', stock: 2, minStock: 1 },
  { id: '3', name: 'Torta Red Velvet', description: 'Torta red velvet con frosting de queso crema', basePrice: 200, category: 'cake', portionSize: 10, pricePerPortion: 14, isActive: true, location: 'production', stock: 1, minStock: 1 },
  { id: '4', name: 'Cupcake Decorado', description: 'Cupcake con diseño personalizado', basePrice: 15, category: 'cupcake', portionSize: 1, pricePerPortion: 15, isActive: true, location: 'store', stock: 24, minStock: 12 },
  { id: '5', name: 'Cheesecake', description: 'Cheesecake New York style', basePrice: 150, category: 'dessert', portionSize: 12, pricePerPortion: 15, isActive: true, location: 'store', stock: 2, minStock: 1 },
  { id: '6', name: 'Brownie', description: 'Brownie con nueces', basePrice: 8, category: 'dessert', portionSize: 1, pricePerPortion: 8, isActive: true, location: 'store', stock: 20, minStock: 10 },
  { id: '7', name: 'Alfajores', description: 'Alfajores de maicena con dulce de leche', basePrice: 5, category: 'dessert', portionSize: 1, pricePerPortion: 5, isActive: true, location: 'store', stock: 30, minStock: 15 },
  { id: '8', name: 'Torta Selva Negra', description: 'Torta de chocolate con cerezas y crema', basePrice: 220, category: 'cake', portionSize: 30, pricePerPortion: 15, isActive: true, location: 'production', stock: 0, minStock: 1 },
];

// Flavors
export const mockFlavors: Flavor[] = [
  { id: '1', name: 'Chocolate', type: 'cake', isActive: true },
  { id: '2', name: 'Vainilla', type: 'cake', isActive: true },
  { id: '3', name: 'Red Velvet', type: 'cake', isActive: true },
  { id: '4', name: 'Zanahoria', type: 'cake', isActive: true },
  { id: '5', name: 'Limón', type: 'cake', isActive: true },
  { id: '6', name: 'Dulce de leche', type: 'filling', isActive: true },
  { id: '7', name: 'Crema pastelera', type: 'filling', isActive: true },
  { id: '8', name: 'Frutilla', type: 'filling', isActive: true },
  { id: '9', name: 'Maracuyá', type: 'filling', isActive: true },
  { id: '10', name: 'Nutella', type: 'filling', isActive: true },
  { id: '11', name: 'Queso crema', type: 'filling', isActive: true },
];

// Orders
export const mockOrders: Order[] = [
  {
    id: '1',
    orderType: 'cake',
    customerName: 'María García',
    customerPhone: '71234567',
    pickupDate: new Date(Date.now() + 86400000),
    pickupTime: '14:00',
    status: 'baking',
    items: [],
    customCakes: [
      { id: '1', portions: 30, shape: 'Redonda', cakeFlavor: 'Chocolate', fillingFlavors: ['Dulce de leche', 'Frutilla'], design: 'Unicornio rosa', dedication: 'Feliz cumple Sofía', referenceImages: [], price: 450, quantity: 1 }
    ],
    deliveryAddress: 'Av. América #123',
    deliveryCost: 30,
    deposit: 200,
    depositMethod: 'qr',
    total: 480,
    createdAt: new Date(),
    createdBy: '2'
  },
  {
    id: '2',
    orderNumber: '0002',
    orderType: 'mixed',
    customerName: 'Carlos López',
    customerPhone: '76543210',
    pickupDate: new Date(Date.now() + 172800000),
    pickupTime: '10:00',
    status: 'pending',
    items: [
      { productId: '4', product: mockProducts[3], quantity: 50, price: 15 }
    ],
    customCakes: [],
    sweetTableCombos: [
      {
        id: '1',
        comboId: '2',
        name: 'Combo 100 postres',
        products: [
          { productId: '4', product: mockProducts[3], quantity: 50, pricePerUnit: 15 },
          { productId: '6', product: mockProducts[5], quantity: 30, pricePerUnit: 8 },
          { productId: '7', product: mockProducts[6], quantity: 20, pricePerUnit: 5 }
        ],
        totalQuantity: 100,
        price: 750
      }
    ],
    sweetTableExtras: [
      { productId: '6', product: mockProducts[5], quantity: 5, price: 8 }
    ],
    deliveryCost: 0,
    deposit: 500,
    depositMethod: 'cash',
    total: 1540,
    createdAt: new Date(),
    createdBy: '2'
  },
  {
    id: '3',
    orderType: 'cake',
    customerName: 'Ana Rodríguez',
    customerPhone: '79876543',
    pickupDate: new Date(Date.now() + 43200000),
    pickupTime: '16:00',
    status: 'decorating',
    items: [],
    customCakes: [
      { id: '2', portions: 20, shape: 'Rectangular', cakeFlavor: 'Vainilla', fillingFlavors: ['Crema pastelera'], design: 'Flores vintage', referenceImages: [], price: 280, quantity: 1 }
    ],
    deliveryCost: 0,
    deposit: 280,
    depositMethod: 'qr',
    total: 280,
    guarantee: { amount: 50, items: 'Pedestal blanco y base dorada' },
    createdAt: new Date(),
    createdBy: '2'
  },
  {
    id: '4',
    orderType: 'cake',
    customerName: 'Roberto Fernández',
    customerPhone: '72233445',
    pickupDate: new Date(Date.now() + 259200000),
    pickupTime: '11:00',
    status: 'assembling',
    items: [],
    customCakes: [
      { id: '3', portions: 50, shape: 'Dos pisos', cakeFlavor: 'Red Velvet', fillingFlavors: ['Queso crema'], design: 'Boda elegante', dedication: 'R & M', referenceImages: [], price: 800, quantity: 1 }
    ],
    deliveryAddress: 'Zona Sur, calle 21',
    deliveryCost: 50,
    deposit: 400,
    depositMethod: 'qr',
    total: 850,
    createdAt: new Date(),
    createdBy: '2'
  },
  {
    id: '5',
    orderType: 'cake',
    customerName: 'Lucía Mendoza',
    customerPhone: '78765432',
    pickupDate: new Date(Date.now() + 7200000),
    pickupTime: '12:00',
    status: 'ready',
    items: [],
    customCakes: [
      { id: '4', portions: 15, cakeFlavor: 'Chocolate', fillingFlavors: ['Nutella'], price: 200, quantity: 1, referenceImages: [] }
    ],
    deliveryCost: 25,
    deposit: 200,
    total: 225,
    createdAt: new Date(),
    createdBy: '2'
  },
  {
    id: '6',
    orderType: 'cake',
    customerName: 'Rodrigo Sanchez',
    customerPhone: '7384132',
    pickupDate: new Date(Date.now() + 7200000),
    pickupTime: '13:00',
    status: 'ready',
    items: [],
    customCakes: [
      { id: '4', portions: 15, cakeFlavor: 'Chocolate', fillingFlavors: ['Nutella'], price: 200, quantity: 1, referenceImages: [] }
    ],
    deliveryAddress: 'Av. América #123',
    deliveryCost: 25,
    deposit: 200,
    total: 225,
    createdAt: new Date(),
    createdBy: '2'
  },
];

// Special Menus
export const mockSpecialMenus: SpecialMenu[] = [
  {
    id: '1',
    name: 'Día de la Madre 2024',
    eventDate: new Date('2024-05-27'),
    startDate: new Date('2024-05-01'),
    endDate: new Date('2024-05-28'),
    products: [
      { productId: '1', product: mockProducts[0], specialPrice: 200, isExclusive: false },
      { productId: '2', product: mockProducts[1], specialPrice: 180, isExclusive: false },
    ],
    isActive: true
  },
  {
    id: '2',
    name: 'San Valentín 2024',
    eventDate: new Date('2024-02-14'),
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-02-15'),
    products: [],
    isActive: false
  }
];

// Sweet Table Combos
export const mockCombos: SweetTableCombo[] = [
  {
    id: '1',
    name: 'Combo 50 postres',
    totalQuantity: 50,
    fixedPrice: 400,
    price: 400,
    products: [
      { productId: '4', product: mockProducts[3], quantity: 20, pricePerUnit: 15 },
      { productId: '6', product: mockProducts[5], quantity: 15, pricePerUnit: 8 },
      { productId: '7', product: mockProducts[6], quantity: 15, pricePerUnit: 5 },
    ],
    isPreset: true,
    isActive: true
  },
  {
    id: '2',
    name: 'Combo 100 postres',
    totalQuantity: 100,
    fixedPrice: 750,
    price: 750,
    products: [
      { productId: '4', product: mockProducts[3], quantity: 40, pricePerUnit: 15 },
      { productId: '6', product: mockProducts[5], quantity: 30, pricePerUnit: 8 },
      { productId: '7', product: mockProducts[6], quantity: 30, pricePerUnit: 5 },
    ],
    isPreset: true,
    isActive: true
  }
];

// Cash Register
export const mockCashRegister: CashRegister = {
  id: '1',
  date: new Date(),
  openingBalance: 500,
  transactions: [
    { id: '1', type: 'deposit', amount: 200, method: 'qr', orderId: '1', description: 'Adelanto pedido #1', createdAt: new Date(), createdBy: '2' },
    { id: '2', type: 'sale', amount: 180, method: 'cash', description: 'Venta torta chocolate', createdAt: new Date(), createdBy: '2' },
    { id: '3', type: 'deposit', amount: 500, method: 'cash', orderId: '2', description: 'Adelanto pedido #2', createdAt: new Date(), createdBy: '2' },
    { id: '4', type: 'expense', amount: -50, method: 'cash', description: 'Compra ingredientes urgente', createdAt: new Date(), createdBy: '1' },
  ],
  status: 'open'
};

// Branches
export const mockBranches: Branch[] = [
  { id: '1', name: 'Sucursal Central', address: 'Av. Heroínas #456', phone: '4567890', isMain: true },
  { id: '2', name: 'Sucursal Norte', address: 'Av. Blanco Galindo km 5', phone: '4567891', isMain: false },
];

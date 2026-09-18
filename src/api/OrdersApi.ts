import api from '@/api/api';
import { mockOrders, mockProducts, mockCombos } from '@/data/mockData';
import type { 
  Order, 
  OrderStatus,
  CustomCake,
  OrderItem,
  OrderCombo,
  OrderFilters,
  CreateOrderData,
  UpdateOrderData,
  Flavor,
  Product,
  PaymentMethod,
  SweetTableCombo
} from '@/types';

export interface IOrdersApi {
  getOrders(filters?: OrderFilters, signal?: AbortSignal): Promise<Order[]>;
  getOrderById(id: string): Promise<Order>;
  createOrder(orderData: CreateOrderData): Promise<Order>;
  updateOrder(id: string, data: UpdateOrderData): Promise<Order>;
  deleteOrder(id: string): Promise<void>;
  updateOrderStatus(id: string, status: OrderStatus, paymentMethod?: PaymentMethod): Promise<Order>;
  getFlavors(): Promise<Flavor[]>;
  getProducts(searchTerm?: string): Promise<Product[]>;
  getSweetTableCombos(): Promise<SweetTableCombo[]>;
}

export class MockOrdersApi implements IOrdersApi {
  private orders: Order[] = [];
  private nextId = 1;
  private products: Product[] = [...mockProducts];

  constructor() {
    this.orders = [...mockOrders];
    this.nextId = this.orders.length + 1;
  }

  async getOrders(filters?: OrderFilters, signal?: AbortSignal): Promise<Order[]> {
    await this.simulateNetworkDelay();
    
    let filtered = [...this.orders];
    
    if (filters) {
      if (filters.status) {
        filtered = filtered.filter(o => o.status === filters.status);
      }
      
      if (filters.startDate && filters.endDate) {
        filtered = filtered.filter(o => 
          o.pickupDate >= filters.startDate! && 
          o.pickupDate <= filters.endDate!
        );
      }
      
      if (filters.customerName) {
        filtered = filtered.filter(o => 
          o.customerName.toLowerCase().includes(filters.customerName!.toLowerCase())
        );
      }
      
      if (filters.customerPhone) {
        filtered = filtered.filter(o => 
          o.customerPhone.includes(filters.customerPhone!)
        );
      }
    }
    
    return filtered;
  }

  async getOrderById(id: string): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const order = this.orders.find(o => o.id === id);
    if (!order) {
      throw new Error(`Order with id ${id} not found`);
    }
    
    return order;
  }

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const newOrder: Order = {
      id: this.nextId.toString(),
      orderNumber: "",
      ...orderData,
      status: 'pending',
      createdAt: new Date(),
      createdBy: 'mock-user',
      total: this.calculateTotal(orderData),
      deposit: orderData.deposit || 0,
      deliveryCost: orderData.deliveryCost || 0,
      items: orderData.items || [],
      customCakes: orderData.customCakes || [],
      notes: orderData.notes || ''
    };
    
    this.orders.push(newOrder);
    this.nextId++;
    
    console.log('Mock order created:', newOrder);
    return newOrder;
  }

  async updateOrder(id: string, data: UpdateOrderData): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }
    
    const updatedOrder = {
      ...this.orders[index],
      ...data,
      total: this.calculateTotal({ ...this.orders[index], ...data } as any)
    };
    
    this.orders[index] = updatedOrder;
    console.log('Mock order updated:', updatedOrder);
    
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<void> {
    await this.simulateNetworkDelay();
    
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }
    
    this.orders.splice(index, 1);
    console.log('Mock order deleted:', id);
  }

  async updateOrderStatus(id: string, status: OrderStatus, paymentMethod?: PaymentMethod): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }
    
    this.orders[index] = { ...this.orders[index], status };
    console.log('Mock order status updated:', { id, status });
    
    return this.orders[index];
  }

  private async simulateNetworkDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private calculateTotal(orderData: CreateOrderData | any): number {
    let total = 0;
    
    // Sumar tortas personalizadas
    if (orderData.customCakes) {
      total += orderData.customCakes.reduce((sum, cake) => 
        sum + (cake.price * (cake.quantity || 1)), 0
      );
    }
    
    // Sumar productos del catálogo
    if (orderData.items) {
      total += orderData.items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );
    }
    
    // Sumar mesas dulces predeterminadas (el precio de cada mesa no cambia al modificar su composición)
    if (orderData.sweetTableCombos) {
      total += orderData.sweetTableCombos.reduce((sum: number, combo: OrderCombo) => 
        sum + (combo.price || 0), 0
      );
    }

    // Sumar postres adicionales agregados manualmente
    if (orderData.sweetTableExtras) {
      total += orderData.sweetTableExtras.reduce((sum: number, extra: OrderItem) => 
        sum + (extra.price || 0) * (extra.quantity || 0), 0
      );
    }
    
    // Sumar costo de envío
    if (orderData.deliveryCost) {
      total += orderData.deliveryCost;
    }
    
    // Aplicar descuento
    if (orderData.discount) {
      total -= orderData.discount;
    }
    
    return total;
  }
  
  async getFlavors(): Promise<Flavor[]> {
    try {
      const response = await api.get('/products/flavors');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener sabores');
      }

      return response.data.data as Flavor[];
    } catch (error: any) {
      console.error('Error en getFlavors:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getProducts(searchTerm: string = ''): Promise<Product[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    let filtered = [...this.products];
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }

  async getSweetTableCombos(): Promise<SweetTableCombo[]> {
    await this.simulateNetworkDelay();
    return [...mockCombos];
  }
}

export class OrdersApi implements IOrdersApi {
  async getOrders(filters?: OrderFilters, signal?: AbortSignal): Promise<Order[]> {
    try {
      const params: any = {};
      
      if (filters) {
        if (filters.status) params.status = filters.status;
        if (filters.startDate) params.startDate = filters.startDate.toISOString();
        if (filters.endDate) params.endDate = filters.endDate.toISOString();
        if (filters.customerName) params.customerName = filters.customerName;
        if (filters.customerPhone) params.customerPhone = filters.customerPhone;
      }
      
      const response = await api.get('/orders', { 
        params,
        signal
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener pedidos');
      }
      
      const orders = response.data.data.map((order: any) => {
        const [year, month, day] = order.pickupDate.split('-');

        return {
          ...order,
          pickupDate: new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
          ),
          createdAt: new Date(order.createdAt)
        };
      });
      
      return orders;
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') {
        console.log('Petición cancelada');
        throw error;
      }
      
      console.error('Error en getOrders:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getOrderById(id: string): Promise<Order> {
    try {
      const response = await api.get(`/orders/${id}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener el pedido');
      }

      const [year, month, day] = response.data.data.pickupDate.split('-');
      
      const order = {
        ...response.data.data,
        pickupDate: new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
          ),
        createdAt: new Date(response.data.data.createdAt)
      };
      
      return order;
    } catch (error: any) {
      console.error('Error en getOrderById:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al obtener el pedido');
    }
  }

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    try {
      const response = await api.post('/orders', orderData);
      
      if (!response.data.success && response.status !== 201) {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }
      
      const order = {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
      
      return order;
    } catch (error: any) {
      console.error('Error en createOrder:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al crear el pedido');
    }
  }

  async updateOrder(id: string, data: UpdateOrderData): Promise<Order> {
    try {
      const response = await api.put(`/orders/${id}`, data);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al actualizar el pedido');
      }
      
      const order = {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
      
      return order;
    } catch (error: any) {
      console.error('Error en updateOrder:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al actualizar el pedido');
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      const response = await api.delete(`/orders/${id}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al eliminar el pedido');
      }
    } catch (error: any) {
      console.error('Error en deleteOrder:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al eliminar el pedido');
    }
  }

  async updateOrderStatus(id: string, status: OrderStatus, paymentMethod?: PaymentMethod): Promise<Order> {
    try {
      const response = await api.patch(`/orders/${id}/status`, { status, paymentMethod });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al actualizar el estado');
      }
      
      const order = {
        ...response.data.data,
        pickupDate: new Date(response.data.data.pickupDate),
        createdAt: new Date(response.data.data.createdAt)
      };
      
      return order;
    } catch (error: any) {
      console.error('Error en updateOrderStatus:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al actualizar el estado');
    }
  }
  
  async getFlavors(): Promise<Flavor[]> {
    try {
      const response = await api.get('/products/flavors');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener sabores');
      }

      return response.data.data as Flavor[];
    } catch (error: any) {
      console.error('Error en getFlavors:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }
  
  async getProducts(searchTerm: string = ''): Promise<Product[]> {
    try {
      const response = await api.get('/products', {
        params: { search: searchTerm || undefined }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener productos');
      }

      return response.data.data as Product[];
    } catch (error: any) {
      console.error('Error en getProducts:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }

  async getSweetTableCombos(): Promise<SweetTableCombo[]> {
    try {
      const response = await api.get('/sweet-table-combos');

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener las mesas dulces');
      }

      return response.data.data as SweetTableCombo[];
    } catch (error: any) {
      console.error('Error en getSweetTableCombos:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
    }
  }
}

export const defaultOrdersApi = new OrdersApi();
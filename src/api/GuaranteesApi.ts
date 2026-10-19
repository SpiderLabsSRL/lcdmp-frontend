import api from '@/api/api';
import type { GuaranteeEntry, PaymentMethod } from '@/types';

export type GuaranteeListStatus = 'pending' | 'returned';

export interface ReturnGuaranteeData {
  // Monto realmente devuelto. Si se omite, se devuelve la garantía completa.
  amount?: number;
  method?: PaymentMethod;
}

export interface IGuaranteesApi {
  getGuarantees(status?: GuaranteeListStatus): Promise<GuaranteeEntry[]>;
  returnGuarantee(orderId: string, data?: ReturnGuaranteeData): Promise<void>;
}

export class MockGuaranteesApi implements IGuaranteesApi {
  private guarantees: GuaranteeEntry[] = [];

  async getGuarantees(status: GuaranteeListStatus = 'pending'): Promise<GuaranteeEntry[]> {
    return this.guarantees.filter(g => (status === 'returned') === (g.returnedAt !== null));
  }

  async returnGuarantee(orderId: string, data: ReturnGuaranteeData = {}): Promise<void> {
    this.guarantees = this.guarantees.map(g =>
      g.orderId === orderId
        ? {
            ...g,
            returnedAt: new Date().toISOString(),
            returnedAmount: data.amount ?? g.amount,
            returnedMethod: data.method ?? 'cash',
          }
        : g
    );
  }
}

export class GuaranteesApi implements IGuaranteesApi {
  async getGuarantees(status: GuaranteeListStatus = 'pending'): Promise<GuaranteeEntry[]> {
    try {
      const response = await api.get('/guarantees', { params: { status } });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al obtener las garantías');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('Error en getGuarantees:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al obtener las garantías');
    }
  }

  async returnGuarantee(orderId: string, data: ReturnGuaranteeData = {}): Promise<void> {
    try {
      const response = await api.post(`/guarantees/${orderId}/return`, data);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al devolver la garantía');
      }
    } catch (error: any) {
      console.error('Error en returnGuarantee:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error al devolver la garantía');
    }
  }
}

export const defaultGuaranteesApi = new GuaranteesApi();

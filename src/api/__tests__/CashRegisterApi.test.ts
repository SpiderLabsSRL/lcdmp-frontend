import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/api/api';
import { CashRegisterApi, MockCashRegisterApi } from '../CashRegisterApi';
import type { ClosingData } from '@/types';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('CashRegisterApi (real, axios-backed)', () => {
  let cashRegisterApi: CashRegisterApi;

  beforeEach(() => {
    vi.clearAllMocks();
    cashRegisterApi = new CashRegisterApi();
  });

  describe('getDailySummary', () => {
    it('gets with empty params when no date is provided', async () => {
      const summary = { cashIncome: 100 };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: summary } });

      const result = await cashRegisterApi.getDailySummary();

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/daily-summary', { params: {} });
      expect(result).toEqual(summary);
    });

    it('sends date as ISO string when provided', async () => {
      const date = new Date('2026-01-15T12:00:00.000Z');
      mockedApi.get.mockResolvedValue({ data: { success: true, data: {} } });

      await cashRegisterApi.getDailySummary(date);

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/daily-summary', {
        params: { date: date.toISOString() },
      });
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'No se pudo obtener el resumen' } });

      await expect(cashRegisterApi.getDailySummary()).rejects.toThrow('No se pudo obtener el resumen');
    });

    it('throws a default message when success is false and there is no message', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false } });

      await expect(cashRegisterApi.getDailySummary()).rejects.toThrow('Error al obtener resumen diario');
    });

    it('throws on a network error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(cashRegisterApi.getDailySummary()).rejects.toThrow('Network Error');
    });
  });

  describe('getTransactions', () => {
    it('sends only the specific date when provided', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await cashRegisterApi.getTransactions({ specificDate: '2026-01-15' });

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/transactions', {
        params: { date: '2026-01-15' },
      });
    });

    it('sends startDate and endDate when specificDate is absent', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await cashRegisterApi.getTransactions({ startDate: '2026-01-01', endDate: '2026-01-31' });

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/transactions', {
        params: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });
    });

    it('sends empty params when no range is provided', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

      await cashRegisterApi.getTransactions({});

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/transactions', { params: {} });
    });

    it('returns the transaction list on success', async () => {
      const transactions = [{ id: '1' }];
      mockedApi.get.mockResolvedValue({ data: { success: true, data: transactions } });

      const result = await cashRegisterApi.getTransactions({});

      expect(result).toEqual(transactions);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'Error de transacciones' } });

      await expect(cashRegisterApi.getTransactions({})).rejects.toThrow('Error de transacciones');
    });

    it('throws on a network error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(cashRegisterApi.getTransactions({})).rejects.toThrow('Network Error');
    });
  });

  describe('registerTransaction', () => {
    const payload = {
      type: 'sale' as const,
      amount: 100,
      method: 'cash' as const,
      orderId: 'ORD-1',
      description: 'Venta',
    };

    it('posts the transaction data and returns the created transaction', async () => {
      const created = { id: 'tx-1', ...payload };
      mockedApi.post.mockResolvedValue({ data: { success: true, data: created } });

      const result = await cashRegisterApi.registerTransaction(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/cash-register/transactions', payload);
      expect(result).toEqual(created);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'No se pudo registrar' } });

      await expect(cashRegisterApi.registerTransaction(payload)).rejects.toThrow('No se pudo registrar');
    });

    it('throws a default message when success is false and there is no message', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false } });

      await expect(cashRegisterApi.registerTransaction(payload)).rejects.toThrow('Error al registrar transacción');
    });

    it('throws on a network error', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(cashRegisterApi.registerTransaction(payload)).rejects.toThrow('Network Error');
    });
  });

  describe('closeCashRegister', () => {
    const closingData: ClosingData = {
      countedCash: 500,
      openingBalanceTomorrow: 100,
      actualCashDifference: 0,
    };

    it('posts the closing data and returns the closed register', async () => {
      const closed = { id: 'reg-1', status: 'closed' };
      mockedApi.post.mockResolvedValue({ data: { success: true, data: closed } });

      const result = await cashRegisterApi.closeCashRegister(closingData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cash-register/close', closingData);
      expect(result).toEqual(closed);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: false, message: 'No se pudo cerrar la caja' } });

      await expect(cashRegisterApi.closeCashRegister(closingData)).rejects.toThrow('No se pudo cerrar la caja');
    });

    it('throws on a network error', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network Error'));

      await expect(cashRegisterApi.closeCashRegister(closingData)).rejects.toThrow('Network Error');
    });
  });

  describe('getCurrentStatus', () => {
    it('returns the status on success', async () => {
      const status = { isOpen: true, openingBalance: 500 };
      mockedApi.get.mockResolvedValue({ data: { success: true, data: status } });

      const result = await cashRegisterApi.getCurrentStatus();

      expect(mockedApi.get).toHaveBeenCalledWith('/cash-register/status');
      expect(result).toEqual(status);
    });

    it('throws with the backend message when success is false', async () => {
      mockedApi.get.mockResolvedValue({ data: { success: false, message: 'No se pudo obtener el estado' } });

      await expect(cashRegisterApi.getCurrentStatus()).rejects.toThrow('No se pudo obtener el estado');
    });

    it('throws on a network error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network Error'));

      await expect(cashRegisterApi.getCurrentStatus()).rejects.toThrow('Network Error');
    });
  });
});

describe('MockCashRegisterApi (in-memory)', () => {
  let mockApi: MockCashRegisterApi;

  beforeEach(() => {
    mockApi = new MockCashRegisterApi();
  });

  it('starts with an open register with a 500 opening balance', async () => {
    const status = await mockApi.getCurrentStatus();

    expect(status.isOpen).toBe(true);
    expect(status.openingBalance).toBe(500);
    expect(status.currentRegister).toBeDefined();
  });

  it('computes the daily summary for today from the seeded transactions', async () => {
    const summary = await mockApi.getDailySummary(new Date());

    // Seeded cash sale (150) + cash deposit (200)
    expect(summary.cashIncome).toBeCloseTo(350);
    // Seeded qr sales (75.50 + 89.99)
    expect(summary.qrIncome).toBeCloseTo(165.49);
    expect(summary.totalIncome).toBeCloseTo(515.49);
    // Seeded expenses (45 + 30)
    expect(summary.totalExpenses).toBeCloseTo(75);
    expect(summary.transactions.length).toBe(6);
  });

  it('returns an empty summary for a date with no transactions', async () => {
    const farPast = new Date('2000-01-01T00:00:00.000Z');
    const summary = await mockApi.getDailySummary(farPast);

    expect(summary.cashIncome).toBe(0);
    expect(summary.qrIncome).toBe(0);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.transactions).toEqual([]);
  });

  it('filters transactions by specificDate', async () => {
    const today = new Date().toISOString();
    const result = await mockApi.getTransactions({ specificDate: today });

    expect(result.length).toBe(6);
  });

  it('filters transactions by a startDate/endDate range', async () => {
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await mockApi.getTransactions({ startDate: start, endDate: end });

    expect(result.length).toBe(6);
  });

  it('returns transactions sorted by most recent first when no filter matches', async () => {
    const result = await mockApi.getTransactions({});

    expect(result[0].id).toBe('1');
    expect(result[result.length - 1].id).toBe('6');
  });

  it('registers a sale transaction with a positive amount', async () => {
    const tx = await mockApi.registerTransaction({
      type: 'sale',
      amount: 50,
      method: 'cash',
      description: 'Nueva venta',
    });

    expect(tx.amount).toBe(50);

    const all = await mockApi.getTransactions({});
    expect(all[0].id).toBe(tx.id);
  });

  it('registers an expense transaction as a negative amount even if given a positive amount', async () => {
    const tx = await mockApi.registerTransaction({
      type: 'expense',
      amount: 20,
      method: 'cash',
      description: 'Nuevo gasto',
    });

    expect(tx.amount).toBe(-20);
  });

  it('closes the register and stores the counted cash as the closing balance', async () => {
    const closed = await mockApi.closeCashRegister({
      countedCash: 480,
      openingBalanceTomorrow: 480,
      actualCashDifference: -20,
    });

    expect(closed.status).toBe('closed');
    expect(closed.closingBalance).toBe(480);
  });

  it('throws when closing an already-closed register', async () => {
    await mockApi.closeCashRegister({
      countedCash: 480,
      openingBalanceTomorrow: 480,
      actualCashDifference: -20,
    });

    await expect(
      mockApi.closeCashRegister({ countedCash: 100, openingBalanceTomorrow: 100, actualCashDifference: 0 })
    ).rejects.toThrow('No hay una caja abierta para cerrar');
  });
});

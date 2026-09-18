import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import CashRegister from '../CashRegister';
import type { DailySummary, Transaction } from '@/types';
import type { ICashRegisterApi } from '@/api/CashRegisterApi';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  type: 'sale',
  amount: 150,
  method: 'cash',
  description: 'Venta de torta',
  createdAt: new Date(2026, 0, 1, 10, 30),
  createdBy: 'u1',
  ...overrides,
});

const emptySummary: DailySummary = {
  cashIncome: 0,
  qrIncome: 0,
  totalIncome: 0,
  totalExpenses: 0,
  openingBalance: 300,
  currentCashBalance: 300,
  currentQrBalance: 0,
  transactions: [],
};

const populatedSummary: DailySummary = {
  cashIncome: 150,
  qrIncome: 70,
  totalIncome: 220,
  totalExpenses: 30,
  openingBalance: 300,
  currentCashBalance: 420,
  currentQrBalance: 0,
  transactions: [
    makeTransaction({ id: 't1', type: 'sale', amount: 150, description: 'Venta de torta' }),
    makeTransaction({ id: 't2', type: 'expense', amount: -30, description: 'Compra de insumos', createdAt: new Date(2026, 0, 1, 11, 0) }),
  ],
};

function buildMockApi(overrides: Partial<ICashRegisterApi> = {}): ICashRegisterApi {
  return {
    getDailySummary: vi.fn().mockResolvedValue(emptySummary),
    getTransactions: vi.fn().mockResolvedValue([]),
    registerTransaction: vi.fn().mockResolvedValue(makeTransaction()),
    closeCashRegister: vi.fn().mockResolvedValue({ id: 'reg-1', date: new Date(), openingBalance: 300, status: 'closed', transactions: [] }),
    getCurrentStatus: vi.fn().mockResolvedValue({ isOpen: true, openingBalance: 300 }),
    ...overrides,
  };
}

describe('CashRegister', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows a loading state while the daily summary is being fetched', async () => {
    let resolvePromise: (value: DailySummary) => void = () => {};
    const pending = new Promise<DailySummary>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getDailySummary: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<CashRegister cashRegisterApi={mockApi} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolvePromise(emptySummary);
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('shows an empty transactions table when there are no movements', async () => {
    const mockApi = buildMockApi();
    renderWithProviders(<CashRegister cashRegisterApi={mockApi} />);

    expect(await screen.findByText('Movimientos del Día')).toBeInTheDocument();
    expect(screen.getByText('Hora')).toBeInTheDocument();
    expect(screen.queryByText('Venta de torta')).not.toBeInTheDocument();
  });

  it('renders populated summary cards and the transactions table', async () => {
    const mockApi = buildMockApi({ getDailySummary: vi.fn().mockResolvedValue(populatedSummary) });
    renderWithProviders(<CashRegister cashRegisterApi={mockApi} />);

    expect(await screen.findByText('Venta de torta')).toBeInTheDocument();
    expect(screen.getByText('Compra de insumos')).toBeInTheDocument();
    expect(screen.getByText('Bs. 420')).toBeInTheDocument(); // currentCashBalance
    expect(screen.getByText('+Bs. 220')).toBeInTheDocument(); // totalIncome card
    expect(screen.getByText('-Bs. 30')).toBeInTheDocument(); // totalExpenses card
    expect(screen.getByText('Caja Abierta')).toBeInTheDocument();
  });

  it('registers a new transaction and reloads the daily data', async () => {
    const mockApi = buildMockApi({ getDailySummary: vi.fn().mockResolvedValue(populatedSummary) });
    const user = userEvent.setup();
    renderWithProviders(<CashRegister cashRegisterApi={mockApi} />);

    await screen.findByText('Venta de torta');
    await user.click(screen.getByRole('button', { name: /Nueva Transacción/i }));

    expect(await screen.findByRole('heading', { name: 'Nueva Transacción' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('0'), '99');
    await user.type(screen.getByPlaceholderText('Descripción de la transacción...'), 'Venta de cupcakes');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(mockApi.registerTransaction).toHaveBeenCalledWith({
        type: 'sale',
        amount: 99,
        method: 'cash',
        description: 'Venta de cupcakes',
      })
    );
    await waitFor(() => expect(mockApi.getDailySummary).toHaveBeenCalledTimes(2));
  });

  it('closes the cash register with the counted cash and tomorrow opening balance', async () => {
    const mockApi = buildMockApi({ getDailySummary: vi.fn().mockResolvedValue(populatedSummary) });
    const user = userEvent.setup();
    renderWithProviders(<CashRegister cashRegisterApi={mockApi} />);

    await screen.findByText('Venta de torta');
    await user.click(screen.getByRole('button', { name: /Cerrar Caja/i }));

    expect(await screen.findByRole('heading', { name: 'Cerrar Caja del Día' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('0'), '415');
    await user.click(screen.getByRole('button', { name: 'Confirmar Cierre' }));

    await waitFor(() =>
      expect(mockApi.closeCashRegister).toHaveBeenCalledWith({
        countedCash: 415,
        openingBalanceTomorrow: 300,
        notes: '',
        actualCashDifference: 415 - 420,
      })
    );
  });
});

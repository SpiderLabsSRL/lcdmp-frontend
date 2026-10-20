import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Guarantees from '../Guarantees';
import type { GuaranteeEntry } from '@/types';
import type { IGuaranteesApi } from '@/api/GuaranteesApi';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';

const renderPage = (api: IGuaranteesApi) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Guarantees api={api} />
      </AuthProvider>
    </MemoryRouter>
  );

const entry = (overrides: Partial<GuaranteeEntry> = {}): GuaranteeEntry => ({
  orderId: 'o1',
  orderNumber: 'ORD-2026-0007',
  customerName: 'Ana Pérez',
  customerPhone: '70011122',
  pickupDate: '2026-10-10',
  items: '1 pedestal grande, 1 base redonda',
  amount: 100,
  returnedAt: null,
  returnedAmount: null,
  returnedMethod: null,
  ...overrides,
});

function buildApi(overrides: Partial<IGuaranteesApi> = {}): IGuaranteesApi {
  return {
    getGuarantees: vi.fn().mockResolvedValue([]),
    returnGuarantee: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Guarantees page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('lists the pending guarantees with what was loaned, who has it and how much to return', async () => {
    const api = buildApi({
      getGuarantees: vi.fn().mockResolvedValue([entry(), entry({ orderId: 'o2', orderNumber: 'ORD-2026-0009', amount: 50, items: 'Base cuadrada' })]),
    });
    renderPage(api);

    expect(await screen.findByText('ORD-2026-0007 · Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('1 pedestal grande, 1 base redonda')).toBeInTheDocument();
    expect(screen.getAllByText('70011122', { exact: false })).toHaveLength(2);
    expect(screen.getByTestId('pending-total')).toHaveTextContent('2 pedidos · a devolver Bs. 150.00');
    expect(api.getGuarantees).toHaveBeenCalledWith('pending');
  });

  it('shows an empty state when nothing is pending', async () => {
    renderPage(buildApi());

    expect(await screen.findByText('No hay garantías pendientes de devolver.')).toBeInTheDocument();
  });

  it('shows an error toast when loading fails', async () => {
    renderPage(buildApi({ getGuarantees: vi.fn().mockRejectedValue(new Error('x')) }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar las garantías'));
  });

  it('returns the whole guarantee in cash by default and says it will be an expense in the cash register', async () => {
    const user = userEvent.setup();
    const getGuarantees = vi.fn().mockResolvedValueOnce([entry()]).mockResolvedValueOnce([]);
    const api = buildApi({ getGuarantees });
    renderPage(api);

    await user.click(await screen.findByRole('button', { name: /Devolver garantía/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Monto a devolver')).toHaveValue(100);
    expect(within(dialog).getByText(/Se registrará un egreso de Bs\. 100\.00 \(Efectivo\) en la caja de hoy/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar devolución' }));

    await waitFor(() => expect(api.returnGuarantee).toHaveBeenCalledWith('o1', { amount: 100, method: 'cash' }));
    expect(toast.success).toHaveBeenCalled();
    // la lista se recarga y la garantía desaparece de pendientes
    expect(await screen.findByText('No hay garantías pendientes de devolver.')).toBeInTheDocument();
  });

  it('allows a partial refund by QR and tells how much is retained', async () => {
    const user = userEvent.setup();
    const api = buildApi({ getGuarantees: vi.fn().mockResolvedValue([entry()]) });
    renderPage(api);

    await user.click(await screen.findByRole('button', { name: /Devolver garantía/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto a devolver'), { target: { value: '70' } });
    await user.click(within(dialog).getByRole('button', { name: 'QR' }));

    expect(within(dialog).getByText(/Se retiene Bs\. 30\.00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/egreso de Bs\. 70\.00 \(QR\)/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar devolución' }));

    await waitFor(() => expect(api.returnGuarantee).toHaveBeenCalledWith('o1', { amount: 70, method: 'qr' }));
  });

  it('refuses to return more than the guarantee', async () => {
    const user = userEvent.setup();
    const api = buildApi({ getGuarantees: vi.fn().mockResolvedValue([entry()]) });
    renderPage(api);

    await user.click(await screen.findByRole('button', { name: /Devolver garantía/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto a devolver'), { target: { value: '150' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar devolución' }));

    expect(toast.error).toHaveBeenCalledWith('El monto a devolver debe estar entre 0 y Bs. 100.00');
    expect(api.returnGuarantee).not.toHaveBeenCalled();
  });

  it('with 0 it says no expense will be recorded', async () => {
    const user = userEvent.setup();
    renderPage(buildApi({ getGuarantees: vi.fn().mockResolvedValue([entry()]) }));

    await user.click(await screen.findByRole('button', { name: /Devolver garantía/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto a devolver'), { target: { value: '0' } });

    expect(within(dialog).getByText('No se registrará ningún egreso en caja.')).toBeInTheDocument();
  });

  it('shows the server error and reloads the list when the return fails (e.g. already returned)', async () => {
    const user = userEvent.setup();
    const getGuarantees = vi.fn().mockResolvedValue([entry()]);
    const api = buildApi({
      getGuarantees,
      returnGuarantee: vi.fn().mockRejectedValue(new Error('La garantía de este pedido ya fue devuelta')),
    });
    renderPage(api);

    await user.click(await screen.findByRole('button', { name: /Devolver garantía/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar devolución' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La garantía de este pedido ya fue devuelta'));
    expect(getGuarantees).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('the "Devueltas" tab lists what was already returned, without a return button', async () => {
    const user = userEvent.setup();
    const returned = entry({
      returnedAt: '2026-10-12T15:30:00.000Z',
      returnedAmount: 80,
      returnedMethod: 'cash',
    });
    const getGuarantees = vi.fn().mockImplementation(async (status: string) => (status === 'returned' ? [returned] : []));
    renderPage(buildApi({ getGuarantees }));
    await screen.findByText('No hay garantías pendientes de devolver.');

    await user.click(screen.getByRole('tab', { name: 'Devueltas' }));

    expect(await screen.findByText(/Devuelta Bs\. 80\.00 en Efectivo/)).toBeInTheDocument();
    expect(screen.getByText(/se retuvo Bs\. 20\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Devolver garantía/ })).not.toBeInTheDocument();
    expect(getGuarantees).toHaveBeenLastCalledWith('returned');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { AdjustStockDialog } from '../AdjustStockDialog';

const mockedToastError = toast.error as unknown as ReturnType<typeof vi.fn>;

describe('AdjustStockDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  const renderDialog = (overrides = {}) => {
    const props = {
      isOpen: true,
      onClose,
      onConfirm,
      itemName: 'Harina',
      itemType: 'raw' as const,
      currentStock: 10,
      ...overrides,
    };
    return render(<AdjustStockDialog {...props} />);
  };

  // DialogContent renders an implicit trailing "Close" (X) icon button after
  // the footer, so the confirm button is the second-to-last button and
  // Cancelar is third-to-last.
  const getConfirmButton = () => {
    const buttons = screen.getAllByRole('button');
    return buttons[buttons.length - 2];
  };

  const getCancelButton = () => {
    const buttons = screen.getAllByRole('button');
    return buttons[buttons.length - 3];
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render dialog content when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('Ajustar Stock')).not.toBeInTheDocument();
  });

  it('renders the item name and current stock', () => {
    renderDialog();
    expect(screen.getByText('Ajustar Stock')).toBeInTheDocument();
    expect(screen.getByText('Harina')).toBeInTheDocument();
    expect(screen.getByText(/Stock actual: 10/)).toBeInTheDocument();
  });

  it('defaults to the "add" operation and shows the resulting stock preview', () => {
    renderDialog();
    // default quantity is 1, currentStock is 10 -> new stock 11
    expect(screen.getByText(/Nuevo stock:/)).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('switches to the "subtract" operation and shows the red preview box', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Restar' }));

    expect(screen.getByText('9')).toBeInTheDocument(); // 10 - 1
  });

  it('switches to the "set" operation and shows the neutral preview box', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Establecer' }));

    expect(screen.getByText(/El stock se establecerá en:/)).toBeInTheDocument();
  });

  it('updates the preview when the quantity changes', async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5');

    expect(screen.getByText('15')).toBeInTheDocument(); // 10 + 5
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms an "add" operation with a positive quantity and closes the dialog', async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '3');

    await user.click(getConfirmButton());

    expect(onConfirm).toHaveBeenCalledWith(3);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms a "subtract" operation with a negative quantity', async () => {
    const user = userEvent.setup();
    renderDialog({ currentStock: 10 });

    await user.click(screen.getByRole('button', { name: 'Restar' }));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '4');

    await user.click(getConfirmButton());

    expect(onConfirm).toHaveBeenCalledWith(-4);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms a "set" operation with the exact quantity entered', async () => {
    const user = userEvent.setup();
    renderDialog({ currentStock: 10 });

    await user.click(screen.getByRole('button', { name: 'Establecer' }));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '7');

    await user.click(getConfirmButton());

    expect(onConfirm).toHaveBeenCalledWith(7);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an error and does not confirm when quantity is 0', async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '0');

    await user.click(getConfirmButton());

    expect(mockedToastError).toHaveBeenCalledWith('La cantidad debe ser mayor a 0');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows an error and does not confirm when subtracting more than the current stock', async () => {
    const user = userEvent.setup();
    renderDialog({ currentStock: 5 });

    await user.click(screen.getByRole('button', { name: 'Restar' }));
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '10');

    await user.click(getConfirmButton());

    expect(mockedToastError).toHaveBeenCalledWith('No hay suficiente stock. Stock actual: 5');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the correct action label for each operation', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(getConfirmButton()).toHaveTextContent('Agregar');

    await user.click(screen.getByRole('button', { name: 'Restar' }));
    expect(getConfirmButton()).toHaveTextContent('Restar');

    await user.click(screen.getByRole('button', { name: 'Establecer' }));
    expect(getConfirmButton()).toHaveTextContent('Establecer');
  });

  it('uses the cancel button distinct from the confirm button', () => {
    renderDialog();
    expect(getCancelButton()).toHaveTextContent('Cancelar');
  });
});

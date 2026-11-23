import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix Select usa ResizeObserver y pointer capture, que jsdom no implementa.
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { BakedLinkDialog } from '../BakedLinkDialog';
import type { IBakedApi } from '@/api/BakedApi';
import type { BakedItem, DoughType, Product } from '@/types';

const cookieType: DoughType = { id: 'dt-cookie', name: 'Galleta de alfajor', usesPortions: false, usesShape: false, isCake: false, isActive: true, usesFlavor: true, isCuttable: false, unitName: null, defaultPortions: null };
const linked: BakedItem = {
  id: 'i2', doughTypeId: 'dt-cookie', doughTypeName: 'Galleta de alfajor', name: 'Galleta de alfajor · Vainilla',
  flavor: 'Vainilla', portions: null, shape: null, quantity: 5, minStock: 0, createdAt: '2026-01-01T00:00:00.000Z',
};

const product = (over: Partial<Product> = {}) => ({ id: 'p1', name: 'Alfajores', ...over }) as Product;

const buildApi = (): IBakedApi => ({
  getDoughTypes: vi.fn().mockResolvedValue([cookieType]),
  getItems: vi.fn().mockResolvedValue([linked]),
  setProductLink: vi.fn().mockResolvedValue(linked),
}) as unknown as IBakedApi;

const ordersApi = { getFlavors: vi.fn().mockResolvedValue([]) } as any;

beforeEach(() => vi.clearAllMocks());

describe('BakedLinkDialog', () => {
  it('prefills the masa already linked to the product', async () => {
    render(<BakedLinkDialog product={product({ bakedProductId: 'i2' })} bakedApi={buildApi()} ordersApi={ordersApi} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByDisplayValue('Vainilla')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar vínculo' })).toBeInTheDocument();
  });

  it('links a masa to the product', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<BakedLinkDialog product={product()} bakedApi={api} ordersApi={ordersApi} onClose={onClose} onSaved={onSaved} />);

    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name: 'Galleta de alfajor' }));
    await user.type(screen.getByLabelText(/Sabor/), 'Vainilla');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.setProductLink).toHaveBeenCalledWith('p1', { doughTypeId: 'dt-cookie', flavor: 'Vainilla', portions: null, shape: null }));
    expect(onSaved).toHaveBeenCalledWith('p1', 'i2');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not save an incomplete link', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    render(<BakedLinkDialog product={product()} bakedApi={api} ordersApi={ordersApi} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(toast.error).toHaveBeenCalledWith('Elige el tipo de masa');
    expect(api.setProductLink).not.toHaveBeenCalled();
  });

  it('removes the link', async () => {
    const user = userEvent.setup();
    const api = buildApi();
    const onSaved = vi.fn();
    render(<BakedLinkDialog product={product({ bakedProductId: 'i2' })} bakedApi={api} ordersApi={ordersApi} onClose={vi.fn()} onSaved={onSaved} />);

    await user.click(await screen.findByRole('button', { name: 'Quitar vínculo' }));

    await waitFor(() => expect(api.setProductLink).toHaveBeenCalledWith('p1', null));
    expect(onSaved).toHaveBeenCalledWith('p1', null);
  });
});

describe('BakedLinkDialog - masas que se cortan', () => {
  const milHojas: DoughType = {
    id: 'dt-mh', name: 'Mil hojas', usesPortions: true, usesShape: false, isCake: false, isActive: true,
    usesFlavor: true, isCuttable: true, unitName: 'lámina', defaultPortions: 12,
  };
  const cuttableApi = (): IBakedApi => ({
    getDoughTypes: vi.fn().mockResolvedValue([milHojas]),
    getItems: vi.fn().mockResolvedValue([]),
    setProductLink: vi.fn().mockResolvedValue(null),
  }) as unknown as IBakedApi;

  const pickType = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('combobox', { name: 'Tipo de masa' }));
    await user.click(await screen.findByRole('option', { name: 'Mil hojas' }));
  };

  it('a product can consume the whole unit (láminas): the default, with no portions', async () => {
    const user = userEvent.setup();
    const api = cuttableApi();
    render(<BakedLinkDialog product={product()} bakedApi={api} ordersApi={ordersApi} onClose={vi.fn()} onSaved={vi.fn()} />);

    await pickType(user);
    expect(screen.getByRole('button', { name: 'lámina entera' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/Porciones/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Sabor/), 'Clásica');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.setProductLink).toHaveBeenCalledWith('p1', expect.objectContaining({
      doughTypeId: 'dt-mh', flavor: 'Clásica', portions: null,
    })));
  });

  it('a product can consume a cut piece: the portions are offered, prefilled from the type', async () => {
    const user = userEvent.setup();
    const api = cuttableApi();
    render(<BakedLinkDialog product={product()} bakedApi={api} ordersApi={ordersApi} onClose={vi.fn()} onSaved={vi.fn()} />);

    await pickType(user);
    await user.click(screen.getByRole('button', { name: 'Pieza cortada' }));

    expect(screen.getByLabelText(/Porciones/)).toHaveValue(12);

    await user.type(screen.getByLabelText(/Sabor/), 'Clásica');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.setProductLink).toHaveBeenCalledWith('p1', expect.objectContaining({
      doughTypeId: 'dt-mh', flavor: 'Clásica', portions: 12,
    })));
  });
});

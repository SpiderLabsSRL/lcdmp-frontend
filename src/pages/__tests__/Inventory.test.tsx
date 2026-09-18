import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Inventory from '../Inventory';
import type { RawMaterial, BakedProduct, Category } from '@/types';
import type { IInventoryApi, LowStockSummary } from '@/api/InventoryApi';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );

const categories: Category[] = [
  { id: 'flour', name: 'Harinas', type: 'raw_material' },
  { id: 'sugar', name: 'Azúcares', type: 'raw_material' },
];

const lowStockMaterial: RawMaterial = {
  id: 'rm1',
  name: 'Harina de Trigo',
  unit: 'kg',
  quantity: 5,
  minStock: 10,
  category: 'flour',
  lastUpdated: new Date(2026, 0, 1),
};

const normalMaterial: RawMaterial = {
  id: 'rm2',
  name: 'Azúcar Blanca',
  unit: 'kg',
  quantity: 50,
  minStock: 8,
  category: 'sugar',
  lastUpdated: new Date(2026, 0, 1),
};

const lowStockBakedProduct: BakedProduct = {
  id: 'bp1',
  name: 'Bizcocho de Vainilla',
  type: 'cake_base',
  quantity: 2,
  minStock: 5,
  createdAt: new Date(2026, 0, 1),
};

const noLowStockSummary: LowStockSummary = { rawMaterials: [], bakedProducts: [], totalLowStock: 0 };

function buildMockApi(overrides: Partial<IInventoryApi> = {}): IInventoryApi {
  return {
    getRawMaterials: vi.fn().mockResolvedValue([]),
    getRawMaterialById: vi.fn(),
    createRawMaterial: vi.fn(),
    updateRawMaterial: vi.fn(),
    deleteRawMaterial: vi.fn(),
    adjustRawMaterialStock: vi.fn().mockResolvedValue(normalMaterial),
    getBakedProducts: vi.fn().mockResolvedValue([]),
    getBakedProductById: vi.fn(),
    createBakedProduct: vi.fn(),
    updateBakedProduct: vi.fn(),
    deleteBakedProduct: vi.fn(),
    adjustBakedProductStock: vi.fn().mockResolvedValue(lowStockBakedProduct),
    getCategories: vi.fn().mockResolvedValue(categories),
    getLowStockItems: vi.fn().mockResolvedValue(noLowStockSummary),
    ...overrides,
  };
}

describe('Inventory', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows a loading state while raw materials are being fetched', async () => {
    let resolvePromise: (value: RawMaterial[]) => void = () => {};
    const pending = new Promise<RawMaterial[]>((resolve) => {
      resolvePromise = resolve;
    });
    const mockApi = buildMockApi({ getRawMaterials: vi.fn().mockReturnValue(pending) });

    const { container } = renderWithProviders(<Inventory inventoryApi={mockApi} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    resolvePromise([]);
    await waitFor(() => expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument());
  });

  it('shows empty states for raw materials and baked products', async () => {
    const mockApi = buildMockApi();
    const user = userEvent.setup();
    renderWithProviders(<Inventory inventoryApi={mockApi} />);

    expect(await screen.findByText('No se encontraron materias primas')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Productos Horneados' }));
    expect(await screen.findByText('No hay productos horneados')).toBeInTheDocument();
  });

  it('renders populated raw materials with low-stock highlighting and shows the low-stock alert', async () => {
    const mockApi = buildMockApi({
      getRawMaterials: vi.fn().mockResolvedValue([lowStockMaterial, normalMaterial]),
      getBakedProducts: vi.fn().mockResolvedValue([lowStockBakedProduct]),
      getLowStockItems: vi.fn().mockResolvedValue({
        rawMaterials: [lowStockMaterial],
        bakedProducts: [lowStockBakedProduct],
        totalLowStock: 2,
      }),
    });
    renderWithProviders(<Inventory inventoryApi={mockApi} />);

    expect(await screen.findByText('Harina de Trigo')).toBeInTheDocument();
    expect(screen.getByText('Azúcar Blanca')).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(screen.getByText('1 materias primas y 1 productos horneados necesitan reposición')).toBeInTheDocument();
  });

  it('hides the low-stock alert when nothing is low on stock', async () => {
    const mockApi = buildMockApi({
      getRawMaterials: vi.fn().mockResolvedValue([normalMaterial]),
      getLowStockItems: vi.fn().mockResolvedValue(noLowStockSummary),
    });
    renderWithProviders(<Inventory inventoryApi={mockApi} />);

    await screen.findByText('Azúcar Blanca');
    expect(screen.queryByText('Stock bajo')).not.toBeInTheDocument();
  });

  it('switches between the raw-materials and baked-products views', async () => {
    const mockApi = buildMockApi({
      getRawMaterials: vi.fn().mockResolvedValue([normalMaterial]),
      getBakedProducts: vi.fn().mockResolvedValue([lowStockBakedProduct]),
    });
    const user = userEvent.setup();
    renderWithProviders(<Inventory inventoryApi={mockApi} />);

    await screen.findByText('Azúcar Blanca');
    expect(screen.queryByText('Bizcocho de Vainilla')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Productos Horneados' }));

    expect(await screen.findByText('Bizcocho de Vainilla')).toBeInTheDocument();
  });

  it('adjusts stock for a raw material through the Agregar dialog', async () => {
    const mockApi = buildMockApi({
      getRawMaterials: vi.fn().mockResolvedValue([normalMaterial]),
    });
    const user = userEvent.setup();
    renderWithProviders(<Inventory inventoryApi={mockApi} />);

    await screen.findByText('Azúcar Blanca');
    await user.click(screen.getByRole('button', { name: /Agregar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Ajustar Stock')).toBeInTheDocument();

    const quantityInput = within(dialog).getByDisplayValue('1');
    await user.clear(quantityInput);
    await user.type(quantityInput, '10');

    const confirmButtons = within(dialog).getAllByRole('button', { name: 'Agregar' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockApi.adjustRawMaterialStock).toHaveBeenCalledWith('rm2', 10));
  });
});

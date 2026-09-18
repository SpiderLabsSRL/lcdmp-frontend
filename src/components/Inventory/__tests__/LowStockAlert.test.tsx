import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LowStockAlert } from '../LowStockAlert';
import type { LowStockSummary } from '@/api/InventoryApi';
import type { RawMaterial, BakedProduct } from '@/types';

const rawMaterials: RawMaterial[] = [
  { id: 'm1', name: 'Harina', unit: 'kg', quantity: 5, minStock: 10, category: 'flour', lastUpdated: new Date(2026, 0, 1) },
  { id: 'm2', name: 'Leche', unit: 'lt', quantity: 2, minStock: 10, category: 'dairy', lastUpdated: new Date(2026, 0, 1) },
];

const bakedProducts: BakedProduct[] = [
  { id: 'b1', name: 'Pan', type: 'bread', quantity: 1, minStock: 5, createdAt: new Date(2026, 0, 1) },
];

describe('LowStockAlert', () => {
  it('renders the counts of low-stock raw materials and baked products', () => {
    const summary: LowStockSummary = {
      rawMaterials,
      bakedProducts,
      totalLowStock: 3,
    };

    render(<LowStockAlert summary={summary} />);

    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(
      screen.getByText('2 materias primas y 1 productos horneados necesitan reposición')
    ).toBeInTheDocument();
  });

  it('renders zero counts when both lists are empty', () => {
    const summary: LowStockSummary = {
      rawMaterials: [],
      bakedProducts: [],
      totalLowStock: 0,
    };

    render(<LowStockAlert summary={summary} />);

    expect(
      screen.getByText('0 materias primas y 0 productos horneados necesitan reposición')
    ).toBeInTheDocument();
  });
});

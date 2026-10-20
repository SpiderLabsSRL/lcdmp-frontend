import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkItemDetailDialog, DesignPreview } from '../WorkItemDetailDialog';
import type { Order, WorkItem } from '@/types';

const order = {
  id: 'o1',
  orderNumber: 'ORD-1',
  customerName: 'Ana Pérez',
  pickupDate: new Date(2026, 9, 21),
  pickupTime: '15:00',
  customCakes: [],
  items: [],
} as unknown as Order;

const mockupItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  itemType: 'mockup',
  itemId: 'm1',
  order,
  status: 'decorating',
  title: 'Maqueta - 3 pisos',
  quantity: 1,
  mockup: { design: 'Torta de 3 pisos azul con flores', floors: 3, heightCm: 12 },
  ...overrides,
});

describe('WorkItemDetailDialog - mockup', () => {
  it('shows the requested design, the floors and the height', () => {
    render(<WorkItemDetailDialog item={mockupItem()} open onOpenChange={() => {}} />);

    expect(screen.getByText('Maqueta - 3 pisos')).toBeInTheDocument();
    expect(screen.getByText('Diseño requerido:')).toBeInTheDocument();
    expect(screen.getByText('Torta de 3 pisos azul con flores')).toBeInTheDocument();
    expect(screen.getByText(/Pisos:/).closest('p')).toHaveTextContent('Pisos: 3');
    expect(screen.getByText(/Altura:/).closest('p')).toHaveTextContent('Altura: 12 cm');
  });

  it('does not show a height line when there is none', () => {
    render(
      <WorkItemDetailDialog
        item={mockupItem({ mockup: { design: 'x', floors: 2, heightCm: null } })}
        open
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText(/Pisos:/).closest('p')).toHaveTextContent('Pisos: 2');
    expect(screen.queryByText(/Altura:/)).not.toBeInTheDocument();
  });

  it('shows the reference images', () => {
    render(
      <WorkItemDetailDialog item={mockupItem({ referenceImages: ['https://signed/a.jpg'] })} open onOpenChange={() => {}} />
    );

    expect(screen.getByText('Imágenes de referencia:')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://signed/a.jpg');
  });
});

describe('DesignPreview - mockup', () => {
  it('shows the design of the mockup on the card (trimmed to 100 characters)', () => {
    const long = 'd'.repeat(120);
    render(<DesignPreview item={mockupItem({ mockup: { design: long, floors: 1 } })} />);

    expect(screen.getByText(`🎨 ${'d'.repeat(100)}...`)).toBeInTheDocument();
  });
});

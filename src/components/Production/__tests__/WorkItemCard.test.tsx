import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Order, WorkItem } from '@/types';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

import { useIsMobile } from '@/hooks/use-mobile';
import { WorkItemCard } from '../WorkItemCard';

const mockedUseIsMobile = useIsMobile as unknown as ReturnType<typeof vi.fn>;

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  orderNumber: 'ORD-42',
  orderType: 'cake',
  customerName: 'Maria Perez',
  customerPhone: '70000000',
  pickupDate: new Date(2026, 8, 25),
  pickupTime: '14:00',
  status: 'baking',
  items: [],
  customCakes: [],
  deliveryCost: 0,
  deposit: 0,
  total: 100,
  createdAt: new Date(2026, 8, 20),
  createdBy: 'u1',
  ...overrides,
});

const makeItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  itemType: 'custom_cake',
  itemId: 'cake-1',
  order: makeOrder(),
  status: 'baking',
  title: '20 porciones - Chocolate',
  quantity: 1,
  ...overrides,
});

describe('WorkItemCard', () => {
  afterEach(() => {
    vi.useRealTimers();
    mockedUseIsMobile.mockReturnValue(false);
  });

  describe.each([
    ['desktop', false],
    ['mobile', true],
  ])('%s layout', (_label, isMobile) => {
    beforeEach(() => {
      mockedUseIsMobile.mockReturnValue(isMobile);
    });

    it('renders the order number, customer name, item title, and pickup date/time', () => {
      const item = makeItem();
      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />
      );

      expect(screen.getByText('#ORD-42')).toBeInTheDocument();
      expect(screen.getByText('Maria Perez')).toBeInTheDocument();
      expect(screen.getByText('20 porciones - Chocolate')).toBeInTheDocument();
      expect(screen.getByText('14:00', { exact: false })).toBeInTheDocument();
      expect(screen.getByText(/25 sep/i)).toBeInTheDocument();
    });

    it('shows "Urgente" when hours until pickup is below urgentHours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 25, 13, 0)); // 1h before pickup
      const item = makeItem();

      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />
      );

      expect(screen.getByText('Urgente')).toBeInTheDocument();
    });

    it('shows "Pronto" when hours until pickup is between urgentHours and soonHours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 25, 4, 0)); // 10h before pickup
      const item = makeItem();

      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />
      );

      expect(screen.getByText('Pronto')).toBeInTheDocument();
    });

    it('shows "Normal" when hours until pickup is above soonHours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 20, 14, 0)); // 5 days before pickup
      const item = makeItem();

      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />
      );

      expect(screen.getByText('Normal')).toBeInTheDocument();
    });

    it('calls onComplete(item) with stopPropagation when the complete button is clicked, without triggering onClick', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const onClick = vi.fn();
      const item = makeItem();

      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={onComplete} onClick={onClick} />
      );

      await user.click(screen.getByRole('button', { name: /completar/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(item);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('calls onClick(item) when the card body is clicked and onClick is provided', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const item = makeItem();

      render(
        <WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} onClick={onClick} />
      );

      await user.click(screen.getByText('Maria Perez'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(item);
    });

    it('does not throw and is not clickable-triggering when onClick is not provided', async () => {
      const user = userEvent.setup();
      const item = makeItem();

      render(<WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />);

      await expect(user.click(screen.getByText('Maria Perez'))).resolves.not.toThrow();
    });

    it('renders custom detail content when provided', () => {
      const item = makeItem();
      render(
        <WorkItemCard
          item={item}
          urgentHours={2}
          soonHours={24}
          onComplete={vi.fn()}
          detail={<p>Detalle personalizado</p>}
        />
      );

      expect(screen.getByText('Detalle personalizado')).toBeInTheDocument();
    });

    it('renders item.notes when present', () => {
      const item = makeItem({ notes: 'Sin gluten por favor' });
      render(<WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />);

      expect(screen.getByText(/Sin gluten por favor/)).toBeInTheDocument();
    });

    it('does not render a notes paragraph when notes is absent', () => {
      const item = makeItem({ notes: undefined });
      render(<WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />);

      expect(screen.queryByText('📝', { exact: false })).not.toBeInTheDocument();
    });

    it('uses the default "Completar" label when completeLabel is not provided', () => {
      const item = makeItem();
      render(<WorkItemCard item={item} urgentHours={2} soonHours={24} onComplete={vi.fn()} />);

      expect(screen.getByRole('button', { name: /completar/i })).toBeInTheDocument();
    });

    it('uses the custom completeLabel text when provided', () => {
      const item = makeItem();
      render(
        <WorkItemCard
          item={item}
          urgentHours={2}
          soonHours={24}
          onComplete={vi.fn()}
          completeLabel="Listo para armar"
        />
      );

      expect(screen.getByRole('button', { name: /listo para armar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^completar$/i })).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltersSection } from '../FiltersSection';
import type { Category } from '@/types';

const categories: Category[] = [
  { id: 'flour', name: 'Harinas', type: 'raw_material' },
  { id: 'dairy', name: 'Lácteos', type: 'raw_material' },
];

function baseProps() {
  return {
    searchTerm: '',
    onSearchChange: vi.fn(),
    selectedCategory: 'all',
    onCategoryChange: vi.fn(),
    categories,
    showFilters: true,
    onToggleFilters: vi.fn(),
    onResetFilters: vi.fn(),
    isLoading: false,
  };
}

describe('FiltersSection', () => {
  beforeEach(() => {
    // jsdom lacks these APIs used by Radix Select internally.
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders the search input with the current search term', () => {
    const props = baseProps();
    render(<FiltersSection {...props} searchTerm="harina" />);

    expect(screen.getByPlaceholderText('Buscar materias primas...')).toHaveValue('harina');
  });

  it('calls onSearchChange as the user types in the search box', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<FiltersSection {...props} />);

    const input = screen.getByPlaceholderText('Buscar materias primas...');
    await user.type(input, 'x');

    expect(props.onSearchChange).toHaveBeenCalledWith('x');
  });

  it('disables the search input while isLoading is true', () => {
    const props = baseProps();
    render(<FiltersSection {...props} isLoading={true} />);

    expect(screen.getByPlaceholderText('Buscar materias primas...')).toBeDisabled();
  });

  it('calls onToggleFilters and reflects showFilters in the mobile toggle label', () => {
    const props = baseProps();
    const { rerender } = render(<FiltersSection {...props} showFilters={false} />);

    expect(screen.getByText('Mostrar filtros')).toBeInTheDocument();

    rerender(<FiltersSection {...props} showFilters={true} />);
    expect(screen.getByText('Ocultar filtros')).toBeInTheDocument();
  });

  it('calls onToggleFilters when the mobile filter toggle button is clicked', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<FiltersSection {...props} />);

    await user.click(screen.getByText(/filtros/i));

    expect(props.onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onResetFilters when the reset button is clicked', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<FiltersSection {...props} />);

    await user.click(screen.getByTitle('Restablecer filtros'));

    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('does not show the active filters summary when no filters are applied', () => {
    const props = baseProps();
    render(<FiltersSection {...props} searchTerm="" selectedCategory="all" />);

    expect(screen.queryByText('Filtros activos:')).not.toBeInTheDocument();
  });

  it('shows active filter badges for the search term and selected category', () => {
    const props = baseProps();
    render(<FiltersSection {...props} searchTerm="harina" selectedCategory="flour" />);

    expect(screen.getByText('Filtros activos:')).toBeInTheDocument();
    expect(screen.getByText('Búsqueda: "harina"')).toBeInTheDocument();
    expect(screen.getByText('Categoría: Harinas')).toBeInTheDocument();
  });

  it('lets the user open the category select and choose an option', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const props = baseProps();
    render(<FiltersSection {...props} />);

    await user.click(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'Harinas' });
    await user.click(option);

    expect(props.onCategoryChange).toHaveBeenCalledWith('flour');
  });
});

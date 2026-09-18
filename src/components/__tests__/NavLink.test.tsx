import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavLink } from '../NavLink';

describe('NavLink', () => {
  it('renders its children and resolves the href', () => {
    render(
      <MemoryRouter initialEntries={['/other']}>
        <NavLink to="/home">Home</NavLink>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/home');
  });

  it('applies activeClassName in addition to className when the route matches', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <NavLink to="/home" className="base" activeClassName="active">
          Home
        </NavLink>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveClass('base');
    expect(link).toHaveClass('active');
  });

  it('does not apply activeClassName when the current route does not match', () => {
    render(
      <MemoryRouter initialEntries={['/other']}>
        <NavLink to="/home" className="base" activeClassName="active">
          Home
        </NavLink>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveClass('base');
    expect(link).not.toHaveClass('active');
  });
});

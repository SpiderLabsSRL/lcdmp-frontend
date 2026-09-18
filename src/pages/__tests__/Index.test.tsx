import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Index from '../Index';

describe('Index', () => {
  it('renders the fallback welcome content', () => {
    render(<Index />);

    expect(screen.getByText('Welcome to Your Blank App')).toBeInTheDocument();
    expect(screen.getByText('Start building your amazing project here!')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title, description, action', () => {
    render(
      <EmptyState
        title="Nothing yet"
        description="Get started by adding your first thing."
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument();
    expect(screen.getByText(/Get started/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

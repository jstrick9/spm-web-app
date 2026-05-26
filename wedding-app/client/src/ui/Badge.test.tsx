import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Pending</Badge>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it.each(['default','brand','accent','success','warning','danger','info','outline'] as const)(
    'renders variant=%s',
    (variant) => {
      const { container } = render(<Badge variant={variant}>x</Badge>);
      expect(container.firstChild).toHaveClass('rounded-pill');
    },
  );
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('forwards onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows a spinner and disables itself when isLoading', () => {
    render(<Button isLoading>Saving</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Lucide Loader2 renders as an svg with class 'animate-spin'
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('respects disabled prop', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders as a different element via asChild', () => {
    render(<Button asChild><a href="/x">Go</a></Button>);
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
  });

  it.each(['default','secondary','outline','ghost','accent','destructive','link'] as const)(
    'renders variant=%s without error',
    (variant) => {
      const { container } = render(<Button variant={variant}>X</Button>);
      expect(container.querySelector('button')).toBeInTheDocument();
    },
  );

  it.each(['xs','sm','md','lg','icon'] as const)('renders size=%s without error', (size) => {
    const { container } = render(<Button size={size}>X</Button>);
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});

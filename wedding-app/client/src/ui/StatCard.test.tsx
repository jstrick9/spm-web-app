import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Bookings" value="42" />);
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders trend with up direction as success color', () => {
    const { container } = render(
      <StatCard label="x" value="1" trend={{ value: 12, direction: 'up' }} />,
    );
    expect(container.querySelector('.text-success')).toBeTruthy();
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });

  it('renders trend with down direction as danger color (default)', () => {
    const { container } = render(
      <StatCard label="x" value="1" trend={{ value: 5, direction: 'down' }} />,
    );
    expect(container.querySelector('.text-danger')).toBeTruthy();
  });

  it('honors isGood override (down can be good for churn-like metrics)', () => {
    const { container } = render(
      <StatCard label="Vacancy" value="3" trend={{ value: 50, direction: 'down', isGood: true }} />,
    );
    expect(container.querySelector('.text-success')).toBeTruthy();
  });

  it('renders benchmark when provided', () => {
    render(<StatCard label="x" value="1" benchmark={{ label: 'Industry', value: '22%' }} />);
    expect(screen.getByText(/Industry/)).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
  });
});

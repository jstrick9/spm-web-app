import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReliabilityBadge } from './ReliabilityBadge';

describe('ReliabilityBadge', () => {
  it('renders the tier label + score for a rated vendor', () => {
    render(<ReliabilityBadge tier="top_rated" score={92} />);
    expect(screen.getByText('Top Rated')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
  });

  it('renders Unrated without a score', () => {
    render(<ReliabilityBadge tier="unrated" score={0} />);
    expect(screen.getByText('Unrated')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });
});

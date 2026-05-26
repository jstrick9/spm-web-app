import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RSVP_META, rsvpOrder, RsvpBadge } from './rsvpMeta';

describe('rsvpMeta', () => {
  it('has metadata for every rsvp status', () => {
    expect(rsvpOrder).toEqual(['pending', 'attending', 'declined', 'maybe']);
    for (const s of rsvpOrder) {
      expect(RSVP_META[s]).toMatchObject({
        label: expect.any(String),
        description: expect.any(String),
        dotColor: expect.any(String),
      });
    }
  });

  it('RsvpBadge renders the right label', () => {
    render(<RsvpBadge status="attending" />);
    expect(screen.getByText('Attending')).toBeInTheDocument();
  });
});
